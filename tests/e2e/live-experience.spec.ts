import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openBattlePanels } from './panels.js';

test('live arena deploys through the existing demo command handler and fits desktop and phones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/stream-demo');
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]+$/);
  const room = new URL(page.url()).pathname.split('/').at(-1)!;
  await expect(page.locator('.live-experience canvas')).toBeVisible();
  await expect(page.getByText('SIMULATED REPLAY · FIXTURE FORGE', { exact: true })).toBeVisible();
  await expect(page.locator('.deployment-dock')).toBeHidden();
  await expect(page.locator('.live-community')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Choose a soldier', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.screenshot({ path: 'docs/screenshots/live-arena-collapsed.png' });
  await openBattlePanels(page);
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
  const stage = await page.locator('.live-battle').boundingBox();
  const dock = await page.locator('.deployment-dock').boundingBox();
  expect(stage!.height).toBeGreaterThan(700);
  expect(dock!.y).toBeGreaterThan(stage!.y);
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(769);
  await page.locator('canvas').evaluate((node) => {
    node.dataset.retained = 'yes';
  });
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.locator('.live-community')).toBeHidden();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.locator('.live-community')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-retained', 'yes');
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  await expect(page.locator('.deployment-dock')).toBeHidden();
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-retained', 'yes');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/live-arena-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobileDock = await page.locator('.deployment-dock').boundingBox();
  const mobileChat = await page.locator('.live-community').boundingBox();
  expect(mobileDock!.y + mobileDock!.height).toBeLessThanOrEqual(mobileChat!.y + 1);
  expect(mobileChat!.y + mobileChat!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'docs/screenshots/live-arena-mobile.png', fullPage: true });
});

test('live arena keeps Twitch sign-in and channel chat separate from operator permissions', async ({
  page,
}) => {
  await page.route('**/api/viewer*', (route) =>
    route.fulfill({ json: { login: null, canManage: false } }),
  );
  await page.route('https://www.twitch.tv/embed/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Mock Twitch chat</title><p>External chat mocked for layout testing</p><button style="position:fixed;bottom:8px;right:8px;width:100px;height:30px">Chat</button>',
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
  await openBattlePanels(page);
  await expect(page.getByRole('link', { name: 'Sign in with Twitch to deploy' })).toHaveAttribute(
    'href',
    new RegExp(`/auth/twitch/viewer\\?room=${room}&origin=`),
  );
  await expect(page.getByRole('button', { name: 'Deploy Archer', exact: true })).toBeDisabled();
  await expect(page.getByTitle('testchannel Twitch chat')).toHaveAttribute(
    'src',
    /parent=localhost/,
  );
  await page
    .getByTitle('testchannel Twitch chat')
    .evaluate((node) => node.setAttribute('data-retained', 'yes'));
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.getByTitle('testchannel Twitch chat')).toBeHidden();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.getByTitle('testchannel Twitch chat')).toBeVisible();
  await expect(page.getByTitle('testchannel Twitch chat')).toHaveAttribute('data-retained', 'yes');
  await expect(page.locator('.live-command-form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send to Twitch', exact: true })).toHaveCount(0);
  await expect(page.getByTitle('testchannel Twitch chat')).toHaveCount(1);
  // A painted iframe can still fail Chromium's occlusion check (e.g. filtered ancestors).
  // Observe from inside the cross-origin frame, as an embedded chat client would.
  const chatComposer = page
    .frameLocator('iframe[title="testchannel Twitch chat"]')
    .getByRole('button', { name: 'Chat', exact: true });
  const chatIsUnobscured = () =>
    chatComposer.evaluate(
      (button) =>
        new Promise<boolean>((resolve) => {
          const observer = new IntersectionObserver(
            ([entry]) => {
              observer.disconnect();
              resolve((entry as IntersectionObserverEntry & { isVisible: boolean }).isVisible);
            },
            { trackVisibility: true, delay: 100 } as IntersectionObserverInit & {
              trackVisibility: boolean;
              delay: number;
            },
          );
          observer.observe(button);
        }),
    );
  await expect.poll(chatIsUnobscured).toBe(true);
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).hover();
  await expect.poll(chatIsUnobscured).toBe(true);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect.poll(chatIsUnobscured).toBe(true);
  }
  await expect(page.getByRole('link', { name: 'Open chat', exact: false })).toHaveAttribute(
    'href',
    'https://www.twitch.tv/popout/testchannel/chat',
  );
  await expect(
    page.getByRole('button', { name: /Reset|Start battle|Pause/, exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/dashboard?room=${room}`);
  await page.getByRole('button', { name: 'Theater view', exact: true }).click();
  await openBattlePanels(page);
  await expect.poll(chatIsUnobscured).toBe(true);
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
