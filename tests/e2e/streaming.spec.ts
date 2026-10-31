import { expect, test } from '@playwright/test';

test('streaming composition preserves deployment and reserves the castle lane on laptop and phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/stream-demo');
  await expect(page).toHaveURL(/\/play\//);
  await expect(page.getByRole('region', { name: 'Host broadcast' })).toBeVisible();
  await expect(page.locator('.arena-canvas')).toHaveAttribute('data-camera', 'lane');
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  await page.getByRole('button', { name: 'Deploy Archer', exact: true }).click();
  await expect(page.locator('.deployment-status')).toContainText('Archer deployed.');
  const room = new URL(page.url()).pathname.split('/').at(-1)!;
  const snapshot = await (await page.request.get(`/api/rooms/${room}`)).json();
  expect(snapshot.game.units.every((u: { y: number }) => u.y === 270)).toBe(true);
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  const lane = await page.locator('.arena-wrap').boundingBox();
  const video = await page.locator('.broadcast-player').boundingBox();
  expect(lane!.y).toBeGreaterThanOrEqual(video!.y + video!.height);
  const canvas = await page.locator('.arena-canvas canvas').boundingBox();
  expect(canvas!.height).toBeLessThanOrEqual(lane!.height);
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(lane!.y + lane!.height);
  await page.screenshot({ path: 'docs/screenshots/streaming-desktop.png' });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/streaming-mobile.png' });
});

test('connected broadcast uses one correctly scoped official player and never appears in OBS', async ({
  page,
}) => {
  let playerLoads = 0;
  await page.route('https://player.twitch.tv/**', (route) => {
    playerLoads++;
    return route.fulfill({
      contentType: 'text/html',
      body: '<body style="background:#18181b;color:white">Twitch broadcast fixture — not a live stream<button>Play</button></body>',
    });
  });
  await page.goto('/stream-demo');
  await expect(page).toHaveURL(/\/play\//);
  const room = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.routeWebSocket(`**/ws/${room}?format=compact`, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      const s = JSON.parse(String(message));
      s.mode = 'live';
      s.channels = [{ id: '100', name: 'testchannel', team: 'ember', status: 'connected' }];
      socket.send(JSON.stringify(s));
    });
  });
  await page.goto(`/play/${room}`);
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.getByRole('button', { name: 'Watch broadcast', exact: true }).click();
  const iframe = page.locator('iframe[title="testchannel live broadcast"]');
  await expect(iframe).toBeVisible();
  const src = new URL((await iframe.getAttribute('src'))!);
  expect(src.searchParams.get('parent')).toBe('localhost');
  expect(src.searchParams.get('channel')).toBe('testchannel');
  expect(src.searchParams.get('autoplay')).toBe('false');
  expect(src.searchParams.get('muted')).toBe('true');
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  expect(playerLoads).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(iframe).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Open stream/ })).toBeVisible();
  await page.goto(`/overlay/${room}?transparent=1`);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
});
