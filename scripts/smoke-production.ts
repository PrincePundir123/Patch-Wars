import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://localhost:3001');
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(1000);
  await page.goto('http://localhost:3001/demo');
  await page.locator('.mode-label').waitFor();
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(1000);
  console.log(
    JSON.stringify({ url: page.url(), canvasCount: await page.locator('canvas').count(), errors }),
  );
  if (errors.length) throw new Error('Production browser errors detected.');
} finally {
  console.log(
    JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 1800) }),
  );
  await browser.close();
}
