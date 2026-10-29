import { test, expect } from '@playwright/test';

test('command guide copies examples, fits phones and never sends a game command', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const id = new URL(page.url()).searchParams.get('room');
  const before = await (await page.request.get(`/api/rooms/${id}`)).json();
  const trigger = page.getByRole('button', { name: 'How to play', exact: true });
  await trigger.click();
  await expect(
    page.getByRole('dialog', { name: 'Your chat is the controller.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Copy !spawn archer', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('!spawn archer');
  await expect(page.locator('.command-copy-status')).toContainText('Copied !spawn archer');
  await expect(page.locator('.command-copy-status')).toContainText('Replay controls');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/command-guide.png' });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  const after = await (await page.request.get(`/api/rooms/${id}`)).json();
  expect(after.game).toEqual(before.game);
});

test('command guide explains clipboard denial without issuing a command', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Denied');
        },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await page.getByRole('button', { name: 'Copy !attack', exact: true }).click();
  await expect(page.locator('.command-copy-status')).toContainText('Type !attack');
});

test('offscreen rendering suspends while server combat continues and resumes in view', async ({
  page,
}) => {
  await page.goto('/demo');
  const canvas = page.locator('.arena-canvas');
  await expect(page.locator('canvas')).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-render-activity', 'active');
  const id = new URL(page.url()).searchParams.get('room');
  const before = await (await page.request.get(`/api/rooms/${id}`)).json();
  await page.locator('#controls').scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-render-activity', 'suspended');
  const count = await canvas.getAttribute('data-render-frames');
  await expect
    .poll(async () => Number((await (await page.request.get(`/api/rooms/${id}`)).json()).game.tick))
    .toBeGreaterThan(before.game.tick);
  expect(await canvas.getAttribute('data-render-frames')).toBe(count);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-render-activity', 'active');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-render-frames')))
    .toBeGreaterThan(Number(count));
});

test('reduced-motion rendering uses a lower frame budget without losing controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demo');
  await expect(page.locator('.arena-canvas')).toHaveAttribute('data-target-fps', '20');
  await page.getByRole('button', { name: 'Theater view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit theater', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('presentation checks report fixture limits and leave the match untouched', async ({
  page,
}) => {
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const id = new URL(page.url()).searchParams.get('room');
  const before = await (await page.request.get(`/api/rooms/${id}`)).json();
  await page.getByText('Presentation readiness', { exact: true }).click();
  await page.getByRole('button', { name: 'Check setup', exact: true }).click();
  await expect(
    page.locator('.readiness-check').filter({ hasText: 'Forge provider' }),
  ).toContainText('Predefined fixture');
  await expect(
    page.locator('.readiness-check').filter({ hasText: 'Battlefield renderer' }),
  ).toContainText('Pass');
  await page.screenshot({ path: 'docs/screenshots/readiness.png', fullPage: true });
  const after = await (await page.request.get(`/api/rooms/${id}`)).json();
  expect(after.game).toEqual(before.game);
});

test('landing defers WebGL until its preview approaches the viewport', async ({ page }) => {
  const rendererRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/assets\/pixi-/.test(request.url())) rendererRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Two communities/ })).toBeVisible();
  await expect(page.locator('.arena-loader')).toHaveAttribute('data-renderer-status', 'deferred');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(rendererRequests).toHaveLength(0);
  await page.locator('.hero-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('canvas')).toBeVisible();
});

test('a failed renderer download offers a bounded reload without creating another match', async ({
  page,
}) => {
  await page.route(
    /\/(?:assets\/Arena-[^/]+\.js|src\/Arena\.tsx)(?:\?|$)/,
    (route) => route.abort(),
    { times: 1 },
  );
  await page.goto('/demo');
  await expect(page.getByRole('button', { name: 'Reload battlefield', exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('room');
  await page.getByRole('button', { name: 'Reload battlefield', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('room')).toBe(id);
});
