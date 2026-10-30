import { expect, test, type Page } from '@playwright/test';
import { openBattlePanels } from './panels.js';
async function liveLayout(page: Page, options: { results?: boolean } = {}) {
  await page.route('https://www.twitch.tv/embed/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Mocked external Twitch chat history</p>' }),
  );
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  const room = new URL(page.url()).searchParams.get('room')!;
  const state = { results: options.results ?? false, expired: false };
  await page.route('**/api/viewer*', (route) =>
    route.fulfill({
      json: {
        login: state.expired ? null : 'streamer',
        source: state.expired ? null : 'channel',
        canManage: true,
      },
    }),
  );
  await page.routeWebSocket(`**/ws/${room}?format=compact`, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      const snapshot = JSON.parse(String(message));
      snapshot.mode = 'live';
      snapshot.channels = [{ id: '100', name: 'testchannel', team: 'ember', status: 'connected' }];
      if (state.results) {
        snapshot.game.phase = 'results';
        snapshot.game.winner = 'ember';
      }
      socket.send(JSON.stringify(snapshot));
    });
  });
  await page.route(`**/api/rooms/${room}/control`, (route) => {
    if (route.request().postDataJSON().action === 'reset') state.results = false;
    return route.continue();
  });
  await page.goto(`/dashboard?room=${room}`);
  await page.getByRole('button', { name: 'Theater view', exact: true }).click();
  await openBattlePanels(page);
  return { room, state };
}
test('the host has only the official chat composer and can rematch and deploy from the same theater', async ({
  page,
}) => {
  const { room } = await liveLayout(page, { results: true });
  await expect(page.getByText('Channel account streamer', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deploy Archer', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start rematch', exact: true })).toBeVisible();
  const messages: unknown[] = [];
  await page.route(`**/api/rooms/${room}/chat`, (route) => {
    messages.push(route.request().postDataJSON());
    return route.fulfill({
      status: 500,
      json: { error: 'The removed app composer must not send requests.' },
    });
  });
  await expect(page.getByTitle('testchannel Twitch chat')).toBeVisible();
  await expect(page.getByTitle('testchannel Twitch chat')).toHaveCount(1);
  await expect(page.locator('.live-command-form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send to Twitch', exact: true })).toHaveCount(0);
  expect(messages).toEqual([]);
  await page.getByRole('button', { name: 'Start rematch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start rematch', exact: true })).toHaveCount(0);
  // OAuth/channel display is mocked; bridge the click into the real owned demo handler.
  await page.route(`**/api/rooms/${room}/viewer-command`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ channelId: '100', text: '!spawn archer' });
    const response = await page.request.post(`/api/rooms/${room}/demo-command`, {
      headers: { origin: new URL(page.url()).origin },
      data: { text: body.text, team: 'ember' },
    });
    await route.fulfill({ status: response.status(), json: await response.json() });
  });
  await page.getByRole('button', { name: 'Deploy Archer', exact: true }).click();
  await expect(page.locator('.deployment-status')).toContainText('Archer deployed.');
  expect(new URL(page.url()).searchParams.get('room')).toBe(room);
  const snapshot = await (await page.request.get(`/api/rooms/${room}`)).json();
  const receipt = snapshot.commandFeedback.find(
    (f: { entityId?: number; message: string }) => f.entityId && f.message === 'Archer deployed.',
  );
  expect(
    snapshot.game.units.some(
      (u: { id: number; blueprintId: string }) =>
        u.id === receipt.entityId && u.blueprintId === 'archer',
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Choose a soldier', exact: true }),
  ).toBeInViewport();
});
test('expired soldier authorization shows the sign-in action instead of silently leaving unusable buttons', async ({
  page,
}) => {
  const { room, state } = await liveLayout(page);
  await page.route(`**/api/rooms/${room}/viewer-command`, (route) => {
    state.expired = true;
    return route.fulfill({
      status: 401,
      json: { error: 'Twitch sign-in expired. Sign in again to continue.' },
    });
  });
  await page.getByRole('button', { name: 'Deploy Archer', exact: true }).click();
  await expect(page.locator('.deployment-status')).toContainText('sign-in expired');
  await expect(
    page.getByRole('link', { name: 'Sign in with Twitch to deploy', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deploy Archer', exact: true })).toBeDisabled();
});
