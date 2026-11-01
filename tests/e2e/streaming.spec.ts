import { expect, test } from '@playwright/test';

test('complete castle tops remain inside the merged scene at desktop and laptop sizes', async ({
  page,
}) => {
  await page.goto('/stream-demo');
  await expect(page).toHaveURL(/\/play\//);
  // Inspect the real asset's alpha, including the sky gaps between each pair of towers.
  const alpha = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/art/castle-foreground-v2.png';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return [
      [0.085, 0.06],
      [0.5, 0.3],
      [0.92, 0.06],
      [0.5, 0.62],
      [0.04, 0.3],
      [0.96, 0.3],
    ].map(
      ([x, y]) =>
        context.getImageData(Math.floor(x! * canvas.width), Math.floor(y! * canvas.height), 1, 1)
          .data[3],
    );
  });
  expect(alpha.slice(0, 3)).toEqual([0, 0, 0]);
  for (const solid of alpha.slice(3)) expect(solid).toBeGreaterThanOrEqual(250);
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    const arena = page.locator('.arena-canvas');
    await expect(arena).toHaveAttribute('data-composite', 'true');
    await expect(arena).toHaveAttribute('data-foreground-status', 'ready');
    await expect
      .poll(async () => Number(await arena.getAttribute('data-castle-top')))
      .toBeGreaterThanOrEqual(8);
    await expect(page.locator('.arena-canvas canvas')).toBeVisible();
    const density = await page
      .locator('.arena-canvas canvas')
      .evaluate((canvas: HTMLCanvasElement) => ({
        pixels: canvas.width,
        displayed: canvas.getBoundingClientRect().width,
      }));
    expect(density.pixels).toBeGreaterThanOrEqual(density.displayed - 1);
    await page.screenshot({ path: `docs/screenshots/complete-castles-${viewport.width}.png` });
  }
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect
    .poll(async () => Number(await page.locator('.arena-canvas').getAttribute('data-castle-top')))
    .toBeGreaterThanOrEqual(8);
});

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
  // The video now extends behind the foreground lane instead of ending above it.
  expect(lane!.y).toBeLessThan(video!.y + video!.height);
  expect(lane!.y + lane!.height).toBeCloseTo(video!.y + video!.height, 0);
  await expect(page.locator('.arena-canvas')).toHaveAttribute('data-composite', 'true');
  await expect(page.locator('.arena-wrap')).toHaveCSS('border-top-width', '0px');
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
      body: '<body style="margin:0;background:linear-gradient(120deg,#6b357e,#227e9f 60%,#db9e67);color:white;font:24px Arial;display:grid;place-content:center;height:100vh"><p>SIMULATED VIDEO - NOT LIVE</p><button>Play</button></body>',
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
  const caption = await page.locator('.broadcast-caption').boundingBox();
  const controls = await page.locator('.broadcast-controls').boundingBox();
  expect(caption!.y + caption!.height).toBeLessThanOrEqual(controls!.y);
  const viewport = await page.locator('.broadcast-viewport').boundingBox();
  const player = await iframe.boundingBox();
  expect(player!.width).toBeGreaterThanOrEqual(viewport!.width - 1);
  expect(player!.height).toBeGreaterThanOrEqual(viewport!.height - 1);
  expect(player!.width / player!.height).toBeCloseTo(16 / 9, 2);
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  expect(playerLoads).toBe(1);
  await page.route('https://www.twitch.tv/embed/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<body style="background:#17171b;color:white;font:16px Arial">Chat fixture - not live</body>',
    }),
  );
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  for (const width of [1920, 1366]) {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
    await expect(page.locator('.arena-canvas')).toHaveAttribute('data-foreground-status', 'ready');
    await page.screenshot({ path: `docs/screenshots/transparent-castles-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(iframe).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Open stream/ })).toBeVisible();
  await page.goto(`/overlay/${room}?transparent=1`);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.arena-canvas')).toHaveAttribute('data-composite', 'false');
  await expect(page.locator('iframe')).toHaveCount(0);
});
