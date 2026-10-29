import { test, expect } from '@playwright/test';

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
