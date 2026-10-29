import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('live arena deploys through the existing demo command handler and fits desktop and phones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  const room = new URL(page.url()).searchParams.get('room')!;
  await page.goto(`/play/${room}`);
  await expect(page.locator('.live-experience canvas')).toBeVisible();
  await expect(page.getByText('SIMULATED REPLAY · FIXTURE FORGE', { exact: true })).toBeVisible();
  const before = await (await page.request.get(`/api/rooms/${room}`)).json();
  await page.getByRole('button', { name: 'Deploy Archer', exact: true }).click();
  await expect(page.locator('.deployment-status')).toContainText('Archer deployed.');
  const after = await (await page.request.get(`/api/rooms/${room}`)).json();
  const receipt = after.commandFeedback.find(
    (f: { command: string; message: string }) =>
      f.command === 'spawn' && f.message === 'Archer deployed.',
  );
  expect(
    after.game.units.some(
      (u: { id: number; blueprintId: string; team: string }) =>
        u.id === receipt.entityId && u.blueprintId === 'archer' && u.team === 'ember',
    ),
  ).toBe(true);
  expect(after.game.catalog).toEqual(before.game.catalog);
  await page.getByRole('button', { name: 'Community Forge', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: 'Your idea. Their problem.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Stream chat', exact: true }).click();
  await expect(page.locator('.live-activity')).toContainText('Archer deployed.');
  const dock = await page.locator('.deployment-dock').boundingBox();
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(769);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/live-arena-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/live-arena-mobile.png', fullPage: true });
});

test('live arena keeps Twitch sign-in and channel chat separate from operator permissions', async ({
  page,
}) => {
  await page.route('**/api/viewer', (route) => route.fulfill({ json: { login: null } }));
  await page.route('https://www.twitch.tv/embed/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Mock Twitch chat</title><p>External chat mocked for layout testing</p>',
    }),
  );
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  const room = new URL(page.url()).searchParams.get('room')!;
  // Use the real snapshot and renderer, changing only the external connection display.
  await page.routeWebSocket(`**/ws/${room}?format=compact`, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      const snapshot = JSON.parse(String(message));
      snapshot.mode = 'live';
      snapshot.channels = [{ id: '100', name: 'testchannel', team: 'ember', status: 'connected' }];
      socket.send(JSON.stringify(snapshot));
    });
  });
  await page.goto(`/play/${room}`);
  await expect(page.getByRole('link', { name: 'Sign in with Twitch to deploy' })).toHaveAttribute(
    'href',
    new RegExp(`/auth/twitch/viewer\\?room=${room}&origin=`),
  );
  await expect(page.getByRole('button', { name: 'Deploy Archer', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Load Twitch chat', exact: true }).click();
  await expect(page.getByTitle('testchannel Twitch chat')).toHaveAttribute(
    'src',
    /parent=localhost/,
  );
  await expect(page.getByRole('link', { name: 'Open chat', exact: false })).toHaveAttribute(
    'href',
    'https://www.twitch.tv/popout/testchannel/chat',
  );
  await expect(
    page.getByRole('button', { name: /Reset|Start battle|Pause/, exact: true }),
  ).toHaveCount(0);
});

test('packaged extension uses helper authorization, renders units and submits one authenticated action', async ({
  page,
}) => {
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  const room = new URL(page.url()).searchParams.get('room')!;
  const snapshot = await (await page.request.get(`/api/rooms/${room}`)).json();
  const commands: unknown[] = [];
  await page.route('**/extension-preview', async (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: await readFile('dist/extension/viewer.html', 'utf8'),
    }),
  );
  await page.route('**/viewer.js', async (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: await readFile('dist/extension/viewer.js', 'utf8'),
    }),
  );
  await page.route('**/viewer.css', async (route) =>
    route.fulfill({
      contentType: 'text/css',
      body: await readFile('dist/extension/viewer.css', 'utf8'),
    }),
  );
  await page.route('**/unit-atlas.webp', async (route) =>
    route.fulfill({
      contentType: 'image/webp',
      body: await readFile('dist/extension/unit-atlas.webp'),
    }),
  );
  await page.route('https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Twitch={ext:{onAuthorized:fn=>fn({token:'mock-helper-token',channelId:'100',clientId:'testextension'}),onVisibilityChanged:()=>{},actions:{requestIdShare:()=>{}}}};`,
    }),
  );
  await page.route('**/api/extension/**', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(route.request().headers().authorization).toBe('Bearer mock-helper-token');
    if (route.request().url().endsWith('/state'))
      return route.fulfill({
        headers,
        json: {
          roomId: room,
          team: 'ember',
          phase: 'battle',
          paused: false,
          commandsEnabled: true,
          energy: 30,
          linked: true,
          catalog: snapshot.game.catalog,
        },
      });
    commands.push(route.request().postDataJSON());
    return route.fulfill({ headers, json: { message: 'Archer deployed.' } });
  });
  await page.goto('/extension-preview');
  await page.getByRole('button', { name: 'Deploy Archer', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Archer deployed.');
  expect(commands).toHaveLength(1);
  expect(commands[0]).toMatchObject({
    roomId: room,
    text: '!spawn archer',
    requestId: expect.any(String),
  });
  await expect(page.getByRole('button', { name: 'Deploy Archer', exact: true })).toBeDisabled();
  await expect(page.locator('iframe')).toHaveCount(0);
});
