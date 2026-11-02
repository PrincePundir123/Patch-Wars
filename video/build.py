"""The PATCH WARS film editor: one scene list in, one finished film out. Nothing is hand-placed on a timeline.

    python3 video/build.py timeline   ->  build/timeline.json (scene starts from the real voice takes)
    python3 video/build.py stills     ->  stills/ (frames and screenshots the drawn scenes use)
    python3 video/build.py gfx        ->  records every drawn scene (graphics.html / three.html) to its exact length
    python3 video/build.py film       ->  final/PatchWars-film.mp4, a 720p copy, captions (.ass burned, .srt) and chapters

Inputs: audio/lines/*.wav and audio/words.json (video/synth.py), clips/*.mp4 (video/record.mjs <flow>),
build/facts.json (video/facts.py), music (video/music.py) and sfx (video/sfx.py), all under ~/Videos/patchwars.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from narration import WORK, load  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
FPS = 30
CLIPS = f"{WORK}/clips"
BUILD = f"{WORK}/build"
FINAL = f"{WORK}/final"
FONTS = os.path.expanduser("~/Videos/housemix/fonts")

# name, lines, visual, chapter, extra hold (s), minimum length (s)
SCENES = [
    ("open", ["n01", "n02", "n03", "n04"], ("gfx",), "The problem", 0.6, 0),
    ("title", ["n05"], ("gfx",), "PATCH WARS", 1.2, 0),
    ("hero", ["n06"], ("clip", "hero", 0.4, 1.0), "PATCH WARS", 0.3, 0),
    # After the three deploy clicks, the camera eases in on the lane where the soldiers meet.
    ("spawn", ["n07", "n08", "n09"], ("clip", "spawn", "panel-1.2", 1.0, {"push": [8.9, 10.4, 1.42, 0.47, 0.8]}),
     "Chat commands", 0.3, 0),
    ("forge", ["n10", "n11", "n12", "n13", "n14"], ("clip", "forge", 9.0, "fit:57"), "The Forge", 0.4, 0),
    ("earn", ["n15", "n16", "n17"], ("clip", "earn", "viewers-0.6", 1.0), "Streamers earn", 0.2, 0),
    ("ext", ["n18"], ("gfx",), "Streamers earn", 0.6, 0),
    ("collab", ["n19", "n20"], ("clip", "sigil", 0.3, 1.0), "Collab battles", 0.4, 0),
    ("live", ["n21"], ("gfx",), "Live on Twitch", 1.4, 0),
    ("arch", ["n22", "n23", "n24"], ("gfx",), "Under the hood", 0.6, 17.5),
    ("codex", ["n25", "n26", "n27", "n28"], ("gfx",), "Built with Codex", 1.0, 0),
    ("recap", ["n29", "n30", "n31", "n32", "n33"], ("gfx",), "Recap", 0.4, 0),
    ("end", ["n34", "n35"], ("gfx",), "", 3.6, 0),
]
LEAD = 0.45
LABELS = {
    "spawn": "Local replay · simulated chat, labelled in the app",
    "forge": "Local replay · fixture Forge output · sped up ×{speed}",
    "earn": "Landing page · Bits estimator (illustrative)",
    "collab": "Landing page · sigils drawn in code",
    "hero": "Landing page",
}


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def gap(text: str, scene: str) -> float:
    if scene == "recap":
        return 0.5
    return 0.72 if text.rstrip().endswith("?") else 0.58


def timeline() -> dict:
    lines = {lid: (scene, caption) for scene, lid, caption, *_ in load()}
    info = json.load(open(f"{WORK}/audio/lines.json"))
    t = 0.0
    scenes = []
    for name, ids, visual, chapter, hold, minimum in SCENES:
        start = t
        cur = t + LEAD
        out = []
        for i, lid in enumerate(ids):
            out.append({"id": lid, "start": round(cur, 3), "dur": info[lid]["s"]})
            cur += info[lid]["s"] + (gap(lines[lid][1], name) if i < len(ids) - 1 else 0)
        end = max(cur + hold, start + minimum)
        # A long scene spreads its spare time between the lines instead of holding at the end.
        if minimum and end - (cur + hold) > 0 and len(out) > 1:
            spare = (end - (cur + hold)) / len(out)
            for i, l in enumerate(out):
                l["start"] = round(l["start"] + spare * i, 3)
        dur = round(round((end - start) * FPS) / FPS, 4)
        scenes.append({"name": name, "start": round(start, 3), "dur": dur, "chapter": chapter, "visual": list(visual),
                       "lines": [{**l, "start": round(l["start"] - start, 3)} for l in out]})
        t = start + dur
    for s in scenes:
        if s["name"] == "arch":
            c = {l["id"]: l["start"] for l in s["lines"]}
            s["cues"] = {"twitch": 0.3, "adapter": c["n22"] + 2.6, "forge": c["n23"], "gate": c["n23"] + 1.0,
                         "blocked": c["n23"] + 1.4, "balance": c["n24"], "arena": c["n24"] + 1.8,
                         "satellites": c["n24"] + 3.4, "final": s["dur"] - 3.2}
    tl = {"total": round(t, 3), "scenes": scenes}
    os.makedirs(BUILD, exist_ok=True)
    json.dump(tl, open(f"{BUILD}/timeline.json", "w"), indent=1)
    for s in scenes:
        print(f"{s['start']:7.2f}  {s['dur']:5.2f}s  {s['name']}")
    print("total", round(t, 2), "s")
    return tl


def mark(flow: str, spec) -> float:
    if isinstance(spec, (int, float)):
        return float(spec)
    marks = json.load(open(f"{CLIPS}/{flow}.marks.json"))
    m = re.match(r"(\w+)([+-][\d.]+)?", spec)
    return marks[m.group(1)] + float(m.group(2) or 0)


def frame(src: str, at: float, out: str) -> None:
    run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(at), "-i", src, "-frames:v", "1", "-q:v", "3", out])


def stills() -> None:
    d = f"{WORK}/stills"
    os.makedirs(d, exist_ok=True)
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{ROOT}/apps/web/public/art/castle-lane.webp", "-vf",
         "scale=1920:-2", "-q:v", "3", f"{d}/castle.jpg"])
    shutil.copy(f"{ROOT}/docs/screenshots/chat-after-repair.png", f"{d}/live.png")
    # The extension panel sits in the lower left of a 1280×720 test page; crop it out at 2×.
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{ROOT}/docs/screenshots/paid-deployment-fixture.png", "-vf",
         "crop=700:300:28:378,scale=1400:-1:flags=lanczos", f"{d}/ext.png"])
    frame(f"{CLIPS}/spawn.mp4", mark("spawn", "bomber") + 2.5, f"{d}/r1.jpg")
    frame(f"{CLIPS}/forge.mp4", 30, f"{d}/r2.jpg")
    frame(f"{CLIPS}/forge.mp4", 24, f"{d}/r3.jpg")
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{d}/ext.png", "-q:v", "3", f"{d}/r4.jpg"])
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{ROOT}/docs/screenshots/streamers-section.png", "-vf",
         "crop=1500:844:0:156", "-q:v", "3", f"{d}/r5.jpg"])
    print("stills in", d)


def gfx(only: set[str]) -> None:
    tl = json.load(open(f"{BUILD}/timeline.json"))
    for s in tl["scenes"]:
        if s["visual"][0] == "gfx" and (not only or s["name"] in only):
            run(["node", f"{ROOT}/video/record.mjs", f"gfx-{s['name']}"])


def drawtext(text: str) -> str:
    font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    t = text.replace(":", r"\:").replace("'", "")
    return (f"drawtext=fontfile={font}:text='{t}':x=48:y=h-64-th:fontsize=24:fontcolor=white@0.92:"
            "box=1:boxcolor=0x0b0d12@0.72:boxborderw=12")


def render_scene(s: dict) -> str:
    out = f"{BUILD}/scene-{s['name']}.mp4"
    dur = s["dur"]
    kind = s["visual"][0]
    if kind == "gfx":
        src = f"{CLIPS}/gfx-{s['name']}.mp4"
        start = json.load(open(f"{CLIPS}/gfx-{s['name']}.marks.json"))["start"]
        speed = 1.0
        label = ""
    else:
        _, flow, at, speed, *opts = s["visual"]
        push = (opts[0] if opts else {}).get("push")
        src = f"{CLIPS}/{flow}.mp4"
        start = mark(flow, at)
        if isinstance(speed, str) and speed.startswith("fit:"):
            speed = round(min(2.0, max(1.0, (float(speed[4:]) - start) / dur)), 2)
        label = LABELS.get(s["name"], "").replace("{speed}", f"{speed:g}")
    vf = [f"setpts=(PTS-STARTPTS)/{speed}", f"fps={FPS}", "scale=1920:1080:flags=lanczos",
          f"tpad=stop_mode=clone:stop_duration={dur + 2}"]
    # A slow 1 → 1.03 push so a held screen is never quite still.
    if kind == "clip" and push:
        # An eased push (cubic ease-out) from the full frame to (cx, cy) at zoom z between t0 and t1, on a 2x upscale.
        t0, t1, z, cx, cy = push
        e = f"(1-pow(1-clip((on/{FPS}-{t0})/{t1 - t0},0,1),3))"
        vf[2] = "scale=3840:2160:flags=lanczos"
        vf.append(f"zoompan=z='1+{z - 1}*{e}':x='clip({e}*({cx}*iw-iw/zoom/2)+(1-{e})*(iw/2-iw/zoom/2),0,iw-iw/zoom)'"
                  f":y='clip({e}*({cy}*ih-ih/zoom/2)+(1-{e})*(ih/2-ih/zoom/2),0,ih-ih/zoom)':d=1:s=1920x1080:fps={FPS}")
    elif kind == "clip":
        vf.append(f"zoompan=z='1+0.03*on/({dur}*{FPS})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps={FPS}")
    if label:
        vf.append(drawtext(label))
    vf += [f"trim=duration={dur}", "setpts=PTS-STARTPTS", "format=yuv420p"]
    run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{start:.3f}", "-i", src, "-vf", ",".join(vf), "-an",
         "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-r", str(FPS), out])
    return out


# --- captions -----------------------------------------------------------------------------------------------------

FIX = [(r"\bPatch Wars\b", "PATCH WARS"), (r"\bpatch wars\b", "PATCH WARS"), (r"\bbits\b", "Bits"),
       (r"\bevent sub\b", "EventSub"), (r"\bEvent Sub\b", "EventSub"), (r"\bO B S\b", "OBS"), (r"\bA I\b", "AI"),
       (r"\bcodex\b", "Codex"), (r"\btwitch\b", "Twitch")]
ACCENT = re.compile(r"PATCH|WARS|Codex|Bits|Twitch|\d|never|one|vote|Forge", re.I)


def ass_time(t: float) -> str:
    t = max(0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def phrases(words: list) -> list[list]:
    out, cur = [], []
    for w in words:
        cur.append(w)
        text = w[0]
        if len(cur) >= 6 or text.endswith((".", "?", ",", ":")) and len(cur) >= 2:
            out.append(cur)
            cur = []
    if cur:
        if out and len(cur) <= 2:
            out[-1] += cur
        else:
            out.append(cur)
    return out


def norm_tok(t: str) -> str:
    return re.sub(r"[^a-z0-9]", "", t.lower())


def aligned(caption: str, heard: list) -> list:
    """The caption's own words (real spelling) on Whisper's word times: matched words take their time, the rest are
    spread between their matched neighbours."""
    import difflib

    toks = caption.split()
    a = [norm_tok(t) for t in toks]
    b = [norm_tok(w) for w, *_ in heard]
    times: list = [None] * len(toks)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2])
    first, last = heard[0][1], heard[-1][2]
    i = 0
    while i < len(toks):
        if times[i] is None:
            j = i
            while j < len(toks) and times[j] is None:
                j += 1
            lo = times[i - 1][1] if i > 0 else first
            hi = times[j][0] if j < len(toks) else last
            step = max(hi - lo, 0.05 * (j - i)) / (j - i)
            for k in range(i, j):
                times[k] = (lo + step * (k - i), lo + step * (k - i + 1))
            i = j
        else:
            i += 1
    return [[t, a0, a1] for t, (a0, a1) in zip(toks, times)]


def captions(tl: dict) -> tuple[str, str]:
    words = json.load(open(f"{WORK}/audio/words.json"))
    caps = {lid: caption for _s, lid, caption, *_ in load()}
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Atkinson Hyperlegible,60,&H00FFFFFF,&H00FFFFFF,&H66000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,120,120,118,1
Style: Chip,Atkinson Hyperlegible,26,&H00E3EFF4,&H00FFFFFF,&H99000000,&H00000000,-1,0,0,0,100,100,2,0,1,2,0,9,60,60,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev, srt = [], []
    gold = r"{\c&H4EC1F2&\fscx108\fscy108}"
    plain = r"{\c&HFFFFFF&\fscx100\fscy100}"
    for s in tl["scenes"]:
        if s["chapter"] and s["name"] not in ("title", "end"):
            ev.append(f"Dialogue: 1,{ass_time(s['start'] + 0.2)},{ass_time(s['start'] + s['dur'] - 0.1)},Chip,,0,0,0,,{s['chapter'].upper()}")
        if s["name"] in ("recap", "end"):
            continue
        for line in s["lines"]:
            base = s["start"] + line["start"]
            ws = aligned(caps[line["id"]], words[line["id"]])
            for p in phrases(ws):
                text = " ".join(w for w, *_ in p)
                for pat, rep in FIX:
                    text = re.sub(pat, rep, text)
                toks = text.split()
                if len(toks) != len(p):
                    toks = [w for w, *_ in p]
                srt.append((base + p[0][1], base + p[-1][2] + 0.25, " ".join(toks)))
                for i, (w, a, b) in enumerate(p):
                    a0 = base + a
                    a1 = base + (p[i + 1][1] if i + 1 < len(p) else b + 0.25)
                    parts = []
                    for j, tok in enumerate(toks):
                        if j == i:
                            parts.append(gold + tok + plain)
                        elif ACCENT.search(tok) and j < i:
                            parts.append(tok)
                        else:
                            parts.append(tok)
                    ev.append(f"Dialogue: 0,{ass_time(a0)},{ass_time(a1)},Cap,,0,0,0,,{' '.join(parts)}")
    ass = f"{BUILD}/captions.ass"
    open(ass, "w").write(head + "\n".join(ev) + "\n")
    srt_path = f"{FINAL}/PatchWars-film.srt"
    os.makedirs(FINAL, exist_ok=True)

    def st(t: float) -> str:
        return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(t * 1000) % 1000:03d}"

    open(srt_path, "w").write("\n".join(f"{i + 1}\n{st(a)} --> {st(b)}\n{t}\n" for i, (a, b, t) in enumerate(srt)))
    return ass, srt_path


# --- sound --------------------------------------------------------------------------------------------------------

def load_wav(path: str) -> np.ndarray:
    a, sr = sf.read(path, dtype="float32", always_2d=True)
    if sr != SR:
        tmp = f"{BUILD}/rs.wav"
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", path, "-ar", str(SR), tmp])
        a, _ = sf.read(tmp, dtype="float32", always_2d=True)
    if a.shape[1] == 1:
        a = np.repeat(a, 2, axis=1)
    return a


def place(track: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i < 0:
        clip, i = clip[-i:], 0
    n = min(len(clip), len(track) - i)
    if n > 0:
        track[i:i + n] += clip[:n] * gain


def sound(tl: dict) -> str:
    total = tl["total"]
    n = int(total * SR) + SR
    voice = np.zeros((n, 2), np.float32)
    for s in tl["scenes"]:
        for line in s["lines"]:
            place(voice, load_wav(f"{WORK}/audio/lines/{line['id']}.wav"), s["start"] + line["start"])
    peak = np.abs(voice).max()
    voice *= 0.5 / max(peak, 1e-6)
    sc = {s["name"]: s for s in tl["scenes"]}
    run([os.path.expanduser("~/Videos/debrief/.venv-music/bin/python"), f"{ROOT}/video/music.py", str(total),
         str(sc["title"]["start"]), str(sc["recap"]["start"]), str(sc["end"]["start"])])
    music = load_wav(f"{WORK}/music/theme.wav")[:n]
    music = np.pad(music, ((0, n - len(music)), (0, 0)))
    # Duck the music under the voice: an envelope of the voice, 150 ms attack and 900 ms release, about 12 dB down.
    env = np.abs(voice[:, 0])
    hop = SR // 100
    frames = env[: len(env) // hop * hop].reshape(-1, hop).max(axis=1)
    active = (frames > 0.02).astype(np.float32)
    g = np.zeros_like(active)
    level = 0.0
    for i, a in enumerate(active):
        level += (a - level) * (1 - np.exp(-1 / (15 if a > level else 90)))
        g[i] = level
    duck = np.repeat(1 - 0.75 * g, hop)
    duck = np.pad(duck, (0, n - len(duck)), constant_values=duck[-1])
    mpeak = np.abs(music).max()
    music = music / max(mpeak, 1e-6) * 0.42 * duck[:, None]
    # Fade the music in over 2 s and out over the last 3 s.
    fade = np.ones(n, np.float32)
    fade[: 2 * SR] = np.linspace(0, 1, 2 * SR)
    end_i = int(total * SR)
    fade[end_i - 3 * SR:end_i] = np.linspace(1, 0, 3 * SR)
    fade[end_i:] = 0
    music *= fade[:, None]
    fx = np.zeros_like(voice)
    S = f"{WORK}/sfx"
    whoosh, hit, riser, click = (load_wav(f"{S}/{k}.wav") for k in ("whoosh", "hit", "riser", "click"))
    for s in tl["scenes"][1:]:
        place(fx, whoosh, s["start"] - 0.3, 0.22)
    place(fx, hit, sc["title"]["start"], 0.5)
    rec = sc["recap"]
    place(fx, riser, rec["start"] - riser.shape[0] / SR, 0.35)
    for line in rec["lines"]:
        place(fx, hit, rec["start"] + line["start"], 0.32)
    cod = sc["codex"]
    for line in cod["lines"][1:]:
        place(fx, hit, cod["start"] + line["start"] + 0.3, 0.25)
    place(fx, hit, sc["end"]["start"], 0.45)
    mix = voice + music + fx
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    out = f"{BUILD}/mix.wav"
    sf.write(out, mix, SR)
    sf.write(f"{BUILD}/voice.wav", voice, SR)
    sf.write(f"{BUILD}/music.wav", music, SR)
    return out


def film() -> None:
    tl = json.load(open(f"{BUILD}/timeline.json"))
    parts = [render_scene(s) for s in tl["scenes"]]
    with open(f"{BUILD}/concat.txt", "w") as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{BUILD}/concat.txt", "-c", "copy",
         f"{BUILD}/picture.mp4"])
    ass, srt = captions(tl)
    mix = sound(tl)
    os.makedirs(FINAL, exist_ok=True)
    out = f"{FINAL}/PatchWars-film.mp4"
    clean = f"{FINAL}/PatchWars-film-nocaptions.mp4"
    common = ["-c:v", "libx264", "-crf", "17", "-preset", "medium", "-tune", "film", "-pix_fmt", "yuv420p",
              "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", str(tl["total"])]
    af = "loudnorm=I=-14.5:TP=-2:LRA=11,alimiter=limit=0.75:level=false"
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{BUILD}/picture.mp4", "-i", mix, "-map", "0:v", "-map", "1:a",
         "-vf", f"ass={ass}:fontsdir={FONTS}", "-af", af, *common, out])
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{BUILD}/picture.mp4", "-i", mix, "-map", "0:v", "-map", "1:a",
         "-af", af, *common, clean])
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", out, "-vf", "scale=1280:720", "-c:v", "libx264", "-crf", "26",
         "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", f"{FINAL}/PatchWars-film-720p.mp4"])
    chapters = []
    for s in tl["scenes"]:
        if s["chapter"] and (not chapters or chapters[-1][1] != s["chapter"]):
            chapters.append((s["start"], s["chapter"]))
    merged = []
    for i, (t, name) in enumerate(chapters):
        nxt = chapters[i + 1][0] if i + 1 < len(chapters) else tl["total"]
        if merged and (nxt - t < 10 or t - merged[-1][0] < 10) and nxt - t < 10:
            continue
        merged.append((t, name))
    text = "\n".join(f"{int(t // 60)}:{int(t % 60):02d} {name}" for t, name in merged)
    open(f"{FINAL}/chapters.txt", "w").write(("0:00 " + merged[0][1] + "\n" + "\n".join(text.splitlines()[1:])) + "\n")
    print("wrote", out, "length", tl["total"], "s")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "timeline":
        timeline()
    elif cmd == "stills":
        stills()
    elif cmd == "gfx":
        gfx(set(sys.argv[2:]))
    elif cmd == "film":
        film()
