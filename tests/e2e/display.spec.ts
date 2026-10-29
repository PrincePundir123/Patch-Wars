import { test, expect, type Page } from '@playwright/test';

async function pausedReplay(page: Page) {
  await page.goto('/demo');
  await expect(page.locator('.battle-stage canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  return new URL(page.url()).searchParams.get('room')!;
}
async function fillsViewport(page: Page) {
  const bounds = await page.locator('.battle-stage').boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeCloseTo(0, 0);
  expect(bounds!.y).toBeCloseTo(0, 0);
  expect(bounds!.width).toBeCloseTo(viewport.width, 0);
  expect(bounds!.height).toBeCloseTo(viewport.height, 0);
  const tools = await page.locator('.broadcast-controls').boundingBox();
  expect(tools!.y + tools!.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.locator('.arena-canvas canvas')).toHaveCSS('object-fit', 'contain');
}

test('theater fills a laptop viewport without remounting the arena or changing match state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const id = await pausedReplay(page);
  const read = async () => (await page.request.get(`/api/rooms/${id}`)).json();
  const before = await read();
  await page.locator('canvas').evaluate((node) => {
    node.dataset.retained = 'yes';
  });
  await page.getByRole('button', { name: 'Unit labels: off', exact: true }).click();
  const enter = page.getByRole('button', { name: 'Theater view', exact: true });
  await enter.click();
  await expect(page.getByRole('dialog', { name: 'Expanded battlefield' })).toBeVisible();
  await fillsViewport(page);
  await expect(page.locator('.studio-sidebar')).toHaveJSProperty('inert', true);
  await expect(page.getByRole('button', { name: 'Unit labels: on', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Focus stays inside the expanded stage and Escape returns it to its trigger.
  await page.getByRole('button', { name: 'Exit theater', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Sound: off', exact: true })).toBeFocused();
  await page.screenshot({ path: 'docs/screenshots/studio-theater.png' });
  await page.keyboard.press('Escape');
  await expect(enter).toBeFocused();
  await expect(page.locator('.studio-sidebar')).toHaveJSProperty('inert', false);
  await expect(page.locator('canvas')).toHaveAttribute('data-retained', 'yes');
  const after = await read();
  expect(after.roomId).toBe(before.roomId);
  expect(after.game).toEqual(before.game);
  expect(after.paused).toBe(true);
});

test('native fullscreen enters and exits through the standard browser API', async ({ page }) => {
  await pausedReplay(page);
  const available = await page.evaluate(() => document.fullscreenEnabled);
  test.skip(
    !available,
    'This browser cannot expose native fullscreen; fallback is tested separately.',
  );
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('battle');
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole('button', { name: 'Theater view', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Theater view', exact: true }).click();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('battle');
  // Browser-driven exits (Escape, switching apps) must synchronize the UI too.
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('button', { name: 'Exit theater', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit theater', exact: true }).click();
});

for (const failure of ['unsupported', 'denied'] as const) {
  test(`fullscreen ${failure} falls back to responsive theater with an accessible exit`, async ({
    page,
  }) => {
    await page.addInitScript((reason) => {
      if (reason === 'unsupported')
        Object.defineProperty(document, 'fullscreenEnabled', { get: () => false });
      else
        HTMLElement.prototype.requestFullscreen = () =>
          Promise.reject(new Error('Permission denied'));
    }, failure);
    await page.setViewportSize({ width: 390, height: 844 });
    await pausedReplay(page);
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await expect(page.locator('.display-notice')).toContainText('Theater view fills this window');
    await fillsViewport(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await fillsViewport(page);
    await page.getByRole('button', { name: 'Exit theater', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
}

test('workspace reflows across phone, tablet and laptop and keeps spectator/OBS boundaries', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const id = await pausedReplay(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Theater view', exact: true })).toBeVisible();
  }
  const spectator = await context.newPage();
  await spectator.goto(`/spectate/${id}`);
  await expect(spectator.getByRole('button', { name: 'Theater view', exact: true })).toBeVisible();
  await expect(spectator.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await spectator.close();
  const overlay = await context.newPage();
  await overlay.goto(`/overlay/${id}?transparent=1`);
  await expect(overlay.locator('canvas')).toBeVisible();
  await expect(overlay.getByRole('button')).toHaveCount(0);
  expect(await overlay.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await overlay.close();
  expect(errors).toEqual([]);
});
