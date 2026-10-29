import { chromium, devices, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createSnapshotDecoder, type SnapshotFrame } from '../packages/shared/src/snapshot-wire.js';

const base = process.env.PROFILE_BASE_URL || 'http://localhost:5173';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  throw new Error('Profile this app on a local server.');
const counters = (page: Page) =>
  page.locator('.arena-canvas').evaluate((node) => ({
    frames: Number((node as HTMLElement).dataset.renderFrames || 0),
    bars: Number((node as HTMLElement).dataset.barRedraws || 0),
    at: Number((node as HTMLElement).dataset.renderReportAt || 0),
    target: Number((node as HTMLElement).dataset.targetFps),
    resolution: Number((node as HTMLElement).dataset.renderResolution),
  }));
const browser = await chromium.launch();
const samples = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(
      mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1366, height: 768 } },
    );
    const page = await context.newPage();
    const decode = createSnapshotDecoder();
    let actualBytes = 0,
      fullBytes = 0,
      snapshots = 0,
      catalogFrames = 0;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('websocket', (socket) =>
      socket.on('framereceived', (event) => {
        const raw = event.payload.toString();
        const frame = JSON.parse(raw) as SnapshotFrame;
        if (frame.type !== 'snapshot') return;
        actualBytes += Buffer.byteLength(raw);
        fullBytes += Buffer.byteLength(JSON.stringify(decode(frame)));
        snapshots++;
        if (frame.game.catalog) catalogFrames++;
      }),
    );
    await page.goto(base + '/demo');
    await page.locator('canvas').waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.locator('.arena-canvas').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => Number(document.querySelector<HTMLElement>('.arena-canvas')?.dataset.renderFrames) > 0,
    );
    const first = await counters(page);
    // Timed sampling window, not a load/readiness sleep.
    await page.waitForTimeout(5000);
    const last = await counters(page);
    await page.locator('#controls').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('.arena-canvas')?.dataset.renderActivity ===
        'suspended',
    );
    const hiddenFirst = await counters(page);
    await page.waitForTimeout(1000);
    const hiddenLast = await counters(page);
    samples.push({
      device: mobile ? 'Chromium phone emulation' : 'Chromium laptop viewport',
      targetFps: last.target,
      resolution: last.resolution,
      measuredFps: (last.frames - first.frames) / ((last.at - first.at) / 1000),
      visibleFrames: last.frames - first.frames,
      healthBarRedrawsDuringPausedSample: last.bars - first.bars,
      offscreenFrames: hiddenLast.frames - hiddenFirst.frames,
      snapshots,
      catalogFrames,
      actualSnapshotBytes: actualBytes,
      estimatedLegacySnapshotBytes: fullBytes,
      snapshotBytesSavedPercent: 100 * (1 - actualBytes / fullBytes),
      pageErrors: errors,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
const html = await readFile('dist/web/index.html', 'utf8');
const script = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
if (!script) throw new Error('Build first so the entry bundle can be measured.');
const entry = await readFile('dist/web' + script);
const report = {
  date: new Date().toISOString(),
  browser: 'Playwright Chromium',
  initialEntryBytes: entry.byteLength,
  entryGzipEstimate: gzipSync(entry).byteLength,
  previousEntryBytes: 1070750,
  samples,
  note: 'Local paused fixture samples. Phone emulation is not physical-device testing; observed FPS is not a guarantee. Legacy wire bytes are reconstructed from the same compact frames. No live Twitch or paid generation request was made.',
};
await mkdir('docs/evaluation', { recursive: true });
await writeFile('docs/evaluation/optimization.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
