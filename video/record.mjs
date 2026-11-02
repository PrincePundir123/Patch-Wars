// Records PATCH WARS as crisp frames (Chrome's screencast, JPEG q92) and writes an exact-timed MP4, plus the
// moments the editor cuts on (marks, in seconds from the first frame).
//   node video/record.mjs <flow> [site]
//   flows: hero, spawn, forge, earn, sigil; gfx-<scene> (graphics.html / three.html)
// Every step is something a visitor or host can do in the local build. The replay's chat is simulated and says so.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(path.join(ROOT, "package.json"))("@playwright/test");

const FLOW = process.argv[2];
const SITE = process.argv[3] || "http://127.0.0.1:5173";
const WORK = `${process.env.HOME}/Videos/patchwars`;
const OUT = `${WORK}/clips`;
const FRAMES = `${OUT}/frames-${FLOW}`;
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

// Headless Chrome on the laptop's GPU through ANGLE's OpenGL backend (the landing's point cloud and the 3D scene).
const browser = await chromium.launch({ args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
// The site: 1536×864 at 1.25 renders its desktop layout into exactly 1920×1080 pixels. The drawn and 3D scenes are
// laid out at 1920×1080 themselves, so they get a window that size at 1×.
const DRAWN = FLOW.startsWith("gfx-");
const SCHEME = "light";
const ctx = await browser.newContext(
  DRAWN
    ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: "dark" }
    : { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, colorScheme: SCHEME, reducedMotion: "no-preference" },
);
await ctx.addInitScript((s) => {
  try {
    localStorage.setItem("theme", s);
  } catch {}
}, SCHEME);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const frames = [];
let t0 = null;
cdp.on("Page.screencastFrame", async (f) => {
  const t = f.metadata.timestamp;
  if (t0 === null) t0 = t;
  const file = `${FRAMES}/${String(frames.length).padStart(5, "0")}.jpg`;
  writeFileSync(file, Buffer.from(f.data, "base64"));
  frames.push({ file, t: t - t0 });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
const marks = {};
// Wall-clock marks on the screencast's clock: frames stop while the page is still, so a frame's time can be stale.
const mark = (name) => {
  marks[name] = t0 === null ? 0 : Date.now() / 1000 - t0;
  console.log("mark", name, marks[name].toFixed(2));
};
const wait = (ms) => page.waitForTimeout(ms);

/** A visible cursor with a soft red halo and a ripple on every click, drawn by the page so it records with it. */
async function cursor() {
  await page.addStyleTag({
    content: `#rec-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      background:rgba(242,193,78,.30);box-shadow:0 0 0 2px rgba(242,193,78,.95),0 0 24px 6px rgba(242,193,78,.25);
      pointer-events:none;z-index:2147483647;transition:transform 120ms cubic-bezier(.16,1,.3,1)}
      #rec-cursor.down{transform:scale(.75)}
      .rec-ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid rgba(242,193,78,.95);
      pointer-events:none;z-index:2147483646;animation:rec-ripple 600ms cubic-bezier(.16,1,.3,1) forwards}
      @keyframes rec-ripple{to{transform:scale(4);opacity:0}}
      nextjs-portal{display:none!important}`,
  });
  await page.evaluate(() => {
    const dot = Object.assign(document.createElement("div"), { id: "rec-cursor" });
    document.body.append(dot);
    addEventListener("mousemove", (e) => (dot.style.translate = `${e.clientX}px ${e.clientY}px`), true);
    addEventListener(
      "mousedown",
      (e) => {
        dot.classList.add("down");
        const r = Object.assign(document.createElement("div"), { className: "rec-ripple" });
        r.style.left = `${e.clientX}px`;
        r.style.top = `${e.clientY}px`;
        document.body.append(r);
        setTimeout(() => r.remove(), 700);
      },
      true,
    );
    addEventListener("mouseup", () => dot.classList.remove("down"), true);
  });
}

let mouse = { x: 768, y: 600 };
/** Glides the cursor to the middle of *locator*, eased, then clicks it. */
async function press(locator, { click = true } = {}) {
  await locator.scrollIntoViewIfNeeded();
  // Aim only once a smooth scroll has settled: the box stops moving between two reads.
  let box = await locator.boundingBox();
  for (let i = 0; i < 20; i++) {
    await wait(80);
    const next = await locator.boundingBox();
    if (next && box && Math.abs(next.y - box.y) < 0.5) break;
    box = next;
  }
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const k = 1 - Math.pow(1 - i / steps, 3);
    await page.mouse.move(mouse.x + (to.x - mouse.x) * k, mouse.y + (to.y - mouse.y) * k);
    await wait(14);
  }
  mouse = to;
  if (click) {
    await wait(120);
    await page.mouse.down();
    await wait(90);
    await page.mouse.up();
  }
}

/** Types like a person into *locator* (the cursor glides there first). */
async function type(locator, text) {
  await press(locator);
  await locator.pressSequentially(text, { delay: 45 });
}

/** Smoothly scrolls the window (or *within*, a scrolling container) so *locator* sits *offset* px below its top. */
async function scrollTo(locator, offset = 110, within = null) {
  await locator.first().evaluate(
    (el, [o, sel]) => {
      const box = sel ? el.closest(sel) : null;
      if (box) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - o, behavior: "smooth" });
      else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - o, behavior: "smooth" });
    },
    [offset, within],
  );
  await wait(900);
}

/** Scrolls the window by *dy* px over *ms*, eased, so a long move reads as one camera move. */
async function glide(dy, ms) {
  const from = await page.evaluate(() => window.scrollY);
  const n = Math.max(1, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const k = 1 - Math.pow(1 - i / n, 3);
    await page.evaluate((y) => window.scrollTo(0, y), from + dy * k);
    await wait(16);
  }
}

async function start(url, ready) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (ready) await ready();
  await cursor();
  await page.mouse.move(mouse.x, mouse.y);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await wait(400);
  mark("start");
}


const sv = () => page.locator(".streamer-value");
const flows = {
  // The landing hero, a slow drift down into the streamer section.
  async hero() {
    await start(SITE + "/");
    await wait(2500);
    mark("drift");
    await glide(520, 2600);
    await wait(2500);
    mark("end");
  },
  // The stream view: open the soldier panel and deploy for Ember, then Azure answers.
  async spawn() {
    await start(SITE + "/stream-demo");
    await wait(1500);
    await press(page.getByRole("button", { name: "Unit labels: off" }));
    await wait(600);
    await press(page.getByRole("button", { name: "Choose a soldier" }));
    await wait(900);
    mark("panel");
    await press(page.getByRole("button", { name: "Deploy Archer" }));
    mark("archer");
    await wait(2200);
    await press(page.getByRole("button", { name: "Deploy Guardian" }));
    mark("guardian");
    await wait(2200);
    await page.getByLabel("Deployment team").selectOption({ index: 1 }).catch(() => {});
    await press(page.getByRole("button", { name: "Deploy Bomber" }));
    mark("bomber");
    await wait(3500);
    await press(page.getByRole("button", { name: "Chat" }));
    mark("chat");
    await wait(4000);
    mark("end");
  },
  // The 90-second replay from the top: proposals, one vote each, the Forge, the reveal, deployment and the split.
  async forge() {
    await start(SITE + "/demo", async () => {
      await page.evaluate(() => window.scrollTo(0, 380));
    });
    await page.mouse.move(1500, 820);
    await wait(60000);
    mark("end");
  },
  // The earnings estimator: viewers up, buyers up, the monthly share follows.
  async earn() {
    await start(SITE + "/", async () => {
      await page.evaluate(() => {
        const el = document.querySelector(".sv-estimator");
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150);
      });
    });
    await wait(1200);
    const sliders = page.locator(".sv-slider input");
    await press(sliders.nth(0));
    await sliders.nth(0).fill("300");
    mark("viewers");
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("ArrowRight");
      await wait(45);
    }
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("ArrowLeft");
      await wait(45);
    }
    await wait(800);
    await press(sliders.nth(1));
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowRight");
      await wait(250);
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowLeft");
      await wait(150);
    }
    mark("result");
    await press(page.locator(".sv-hero-number"), { click: false });
    await wait(3000);
    await press(page.locator(".sv-products"), { click: false });
    await wait(2500);
    mark("end");
  },
  // Collab banner, then the sigil forge: describe a warrior, pick a side, strike the anvil.
  async sigil() {
    await start(SITE + "/", async () => {
      await page.evaluate(() => {
        const el = document.querySelector(".sv-collab");
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120);
      });
    });
    await wait(2500);
    mark("collab");
    await glide(360, 1800);
    await wait(500);
    const box = page.locator(".sv-forge textarea");
    await press(box);
    await box.fill("");
    await box.pressSequentially("A fire bomber that explodes into three embers", { delay: 40 });
    mark("typed");
    await press(page.locator(".sv-team button.ember"));
    await wait(500);
    await press(page.locator(".sv-strike"));
    mark("strike");
    await wait(2500);
    await press(page.locator(".sv-crest-row"), { click: false });
    await wait(2500);
    mark("end");
  },
};

async function graphics(name) {
  const timeline = JSON.parse(readFileSync(`${WORK}/build/timeline.json`, "utf8"));
  const scene = timeline.scenes.find((x) => x.name === name);
  const cues = scene.cues ?? Object.fromEntries(scene.lines.map((l) => [l.id, +l.start.toFixed(3)]));
  const all = existsSync(`${WORK}/audio/words.json`) ? JSON.parse(readFileSync(`${WORK}/audio/words.json`, "utf8")) : {};
  const words = Object.fromEntries((scene.lines ?? []).map((l) => [l.id, (all[l.id] || []).map(([w, a]) => [w, a])]));
  const facts = readFileSync(`${WORK}/build/facts.json`, "utf8");
  const stills = pathToFileURL(`${WORK}/stills`).href;
  const hash = `scene=${name}&dur=${scene.dur}&cues=${encodeURIComponent(JSON.stringify(cues))}&words=${encodeURIComponent(JSON.stringify(words))}&facts=${encodeURIComponent(facts)}&stills=${encodeURIComponent(stills)}`;
  const file = name === "arch" ? "three.html" : "graphics.html";
  await page.goto(`${pathToFileURL(path.join(ROOT, "video", file)).href}#${hash}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await wait(300);
  mark("start");
  await page.evaluate(() => window.__start());
  await wait(scene.dur * 1000 + 300);
  mark("end");
}

if (FLOW.startsWith("gfx-")) await graphics(FLOW.slice(4));
else await flows[FLOW]();
await cdp.send("Page.stopScreencast");
await browser.close();

// Exact-timed video: each frame lasts until the next one (the screencast only sends frames when something changes).
// The last frame lasts until the flow's end mark, so a still ending isn't cut short.
// At high frame rates the screencast can deliver frames out of order: sort them, and never write a zero duration.
frames.sort((a, b) => a.t - b.t);
const lastUntil = Math.max((frames.at(-1)?.t ?? 0) + 0.5, marks.end ?? 0);
const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? lastUntil) - f.t).toFixed(4)}`).join("\n");
writeFileSync(`${FRAMES}/list.txt`, `${list}\nfile '${frames.at(-1).file}'\n`);
const r = spawnSync(
  "ffmpeg",
  [
    "-loglevel",
    "error",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    `${FRAMES}/list.txt`,
    "-vf",
    "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-crf",
    "16",
    "-preset",
    "medium",
    `${OUT}/${FLOW}.mp4`,
  ],
  { stdio: "inherit" },
);
writeFileSync(`${OUT}/${FLOW}.marks.json`, JSON.stringify(marks, null, 1));
// Kept when the encode fails, to see why.
if (r.status === 0) rmSync(FRAMES, { recursive: true, force: true });
console.log(FLOW, frames.length, "frames,", (frames.at(-1)?.t ?? 0).toFixed(1), "s; ffmpeg", r.status);
