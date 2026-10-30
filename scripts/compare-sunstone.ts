import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const sourcePath = 'docs/design/sunstone/selected-reference.png';
const targetPath = 'docs/screenshots/sunstone-desktop.png';
const source = await readFile(sourcePath),
  target = await readFile(targetPath);
const data = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1160 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<style>
    *{box-sizing:border-box}body{margin:0;padding:20px;background:#eee7d7;color:#20372c;font:16px Arial}
    h1{font:26px Georgia;margin:0 0 12px}p{margin:0 0 20px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    figure{margin:0;min-width:0}figcaption{font-weight:bold;margin:0 0 8px}img{display:block;width:100%}
    .crop{height:400px;overflow:hidden;position:relative;background:#14251e}
    .crop img{position:absolute;width:1920px;max-width:none;height:auto;left:-600px;top:-350px}
    .source img{width:1672px;left:-360px;top:-180px}
  </style><h1>Sunstone Battleground: visual QA</h1>
  <p>Selected concept versus actual browser-rendered fixture replay. The concept's lower pose-study strip is documentation, not live UI.</p>
  <main><figure><figcaption>Selected source concept</figcaption><img src="${data(source)}"></figure>
  <figure><figcaption>Running implementation, 1920 × 1080</figcaption><img src="${data(target)}"></figure>
  <figure><figcaption>Source: soldier silhouettes and combat materials</figcaption><div class="crop source"><img src="${data(source)}"></div></figure>
  <figure><figcaption>Implementation: actual sprites, ground contact and team colors</figcaption><div class="crop"><img src="${data(target)}"></div></figure></main>`);
  await page
    .locator('img')
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    );
  await page.screenshot({ path: 'docs/screenshots/sunstone-comparison.png', fullPage: true });
  console.log(
    JSON.stringify({
      source: { path: sourcePath, width: source.readUInt32BE(16), height: source.readUInt32BE(20) },
      implementation: {
        path: targetPath,
        width: target.readUInt32BE(16),
        height: target.readUInt32BE(20),
      },
      density: 1,
    }),
  );
} finally {
  await browser.close();
}
