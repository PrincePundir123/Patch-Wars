import { expect, test } from '@playwright/test';

test('Sunstone uses real artwork and pose animation while pause preserves authoritative combat', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: 'test-results/sunstone-motion', size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto('/stream-demo');
    await expect(page).toHaveURL(/\/play\/[0-9a-f-]+$/);
    const room = new URL(page.url()).pathname.split('/').at(-1)!;
    const canvas = page.locator('.arena-canvas');
    await expect(canvas).toHaveAttribute('data-art-direction', 'sunstone');
    await expect(canvas).toHaveAttribute('data-artwork-status', 'ready');
    await expect(canvas).toHaveAttribute('data-animation-frames', '12');
    await expect(canvas).toHaveAttribute('data-camera', 'lane');
    await page.locator('canvas').evaluate((node) => (node.dataset.sunstoneRetained = 'yes'));
    await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
    await page.getByRole('button', { name: 'Deploy Archer', exact: true }).click();
    await expect(page.locator('.deployment-status')).toContainText('Archer deployed.');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-pose-updates')))
      .toBeGreaterThan(10);
    // Observe a real moving battle, not a static screenshot or a manually animated fixture.
    await expect
      .poll(async () => (await (await page.request.get(`/api/rooms/${room}`)).json()).game.tick, {
        timeout: 25000,
      })
      .toBeGreaterThan(300);
    await page.mouse.move(2, 2);
    await page.screenshot({ path: 'docs/screenshots/castle-lane-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(canvas).toHaveAttribute('data-camera', 'lane');
    await expect(page.locator('canvas')).toHaveAttribute('data-sunstone-retained', 'yes');
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Deploy Archer', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: 'docs/screenshots/castle-lane-mobile.png' });
    const response = await page.request.post(`/api/rooms/${room}/control`, {
      headers: { Origin: new URL(page.url()).origin },
      data: { action: 'pause' },
    });
    expect(response.ok()).toBe(true);
    await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
    const before = (await (await page.request.get(`/api/rooms/${room}`)).json()).game;
    // Allow the bounded interpolation window to settle before checking animation freeze.
    await page.waitForTimeout(1200);
    const poses = await canvas.getAttribute('data-pose-updates');
    await page.waitForTimeout(1100);
    expect(await canvas.getAttribute('data-pose-updates')).toBe(poses);
    const after = (await (await page.request.get(`/api/rooms/${room}`)).json()).game;
    expect(after).toEqual(before);
    for (const action of ['reset', 'start']) {
      const result = await page.request.post(`/api/rooms/${room}/control`, {
        headers: { Origin: new URL(page.url()).origin },
        data: { action },
      });
      expect(result.ok()).toBe(true);
    }
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-visual-resets')))
      .toBeGreaterThan(0);
    await expect(page.locator('canvas')).toHaveAttribute('data-sunstone-retained', 'yes');
    expect(errors).toEqual([]);
  } finally {
    const video = page.video();
    await context.close();
    await video?.saveAs('docs/screenshots/castle-motion.webm');
  }
});

