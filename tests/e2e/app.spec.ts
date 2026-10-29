import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
test('measures local chat-to-overlay presentation and browser frame intervals', async ({
  page,
}) => {
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByLabel('Simulated chat command').fill('!forge a moss turtle with a shield');
  const start = performance.now();
  await page.getByRole('button', { name: 'Send ↗', exact: true }).click();
  await expect(
    page.locator('.proposal-content').getByText('a moss turtle with a shield', { exact: true }),
  ).toBeVisible();
  const latency = performance.now() - start;
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const values: number[] = [];
        let last = performance.now();
        function frame(now: number) {
          values.push(now - last);
          last = now;
          if (values.length < 120) requestAnimationFrame(frame);
          else resolve(values.slice(1));
        }
        requestAnimationFrame(frame);
      }),
  );
  const sorted = [...frames].sort((a, b) => a - b);
  const canvas = await page.locator('canvas').boundingBox();
  const parent = await page.locator('.arena-canvas').boundingBox();
  expect(Math.abs(canvas!.width - parent!.width)).toBeLessThan(2);
  await mkdir('docs/evaluation', { recursive: true });
  await writeFile(
    'docs/evaluation/browser.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        mode: 'local simulated replay in Playwright Chromium',
        chatToOverlayMs: latency,
        frameSamples: frames.length,
        meanFrameIntervalMs: frames.reduce((a, b) => a + b, 0) / frames.length,
        p95FrameIntervalMs: sorted[Math.floor(sorted.length * 0.95)],
        viewport: page.viewportSize(),
        note: 'One automated local command sample. Includes browser automation overhead; not a live Twitch or GPU-independent benchmark.',
      },
      null,
      2,
    ),
  );
});
test('landing and mobile layout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Two communities/ })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/landing.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/mobile-landing.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('replay forges and deploys a splitting unit; controls and OBS work', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/demo');
  await expect(page.getByText('◈ SIMULATED REPLAY', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('UNIT DEPLOYED', { exact: true })).toBeVisible({ timeout: 45000 });
  await expect(page.getByText('200', { exact: true })).toBeVisible();
  await expect(page.getByText(/death → split/)).toBeVisible();
  await page.getByRole('button', { name: 'Ⅱ Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: '▶ Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '▣ Copy OBS link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Overlay URL copied');
  const id = new URL(page.url()).searchParams.get('room');
  await page.screenshot({ path: 'docs/screenshots/dashboard.png', fullPage: true });
  const overlay = await context.newPage();
  await overlay.goto(`/overlay/${id}?transparent=1`);
  await expect(overlay.locator('canvas')).toBeVisible();
  await expect(overlay.getByRole('button', { name: /Start|Pause|Reset/ })).toHaveCount(0);
  await overlay.setViewportSize({ width: 1920, height: 1080 });
  await overlay.screenshot({ path: 'docs/screenshots/overlay.png' });
  await overlay.close();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/mobile-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: '↺ Reset', exact: true }).click();
  await expect(page.getByRole('button', { name: '▶ Start battle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '▶ Start battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ⅱ Pause', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('dashboard shows honest setup and invalid operator error', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Bring your Twitch community.' })).toBeVisible();
  await page.getByLabel('Operator key').fill('invalid-key');
  await page.getByRole('button', { name: 'Unlock control room' }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect or not configured');
});

test('viewer feedback identifies spawns and explains paused commands', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByLabel('Simulated chat command').fill('!spawn archer');
  await page.locator('.command-form button[type=submit]').click();
  await expect(page.locator('.command-feedback')).toContainText('Archer deployed.');
  const id = new URL(page.url()).searchParams.get('room');
  const snapshot = await (await page.request.get(`/api/rooms/${id}`)).json();
  const receipt = snapshot.commandFeedback.find(
    (r: { entityId?: number }) => r.entityId !== undefined,
  );
  expect(
    snapshot.game.units.some(
      (u: { id: number; blueprintId: string }) =>
        u.id === receipt.entityId && u.blueprintId === 'archer',
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Unit labels: off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unit labels: on', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Sound: off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sound: on', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Sound: on', exact: true }).click();
  await page.getByRole('button', { name: /Pause/, exact: false }).click();
  await page.getByLabel('Simulated chat command').fill('!spawn guardian');
  await page.locator('.command-form button[type=submit]').click();
  await expect(page.locator('.command-feedback')).toContainText('Battle paused');
  expect(errors).toEqual([]);
});
