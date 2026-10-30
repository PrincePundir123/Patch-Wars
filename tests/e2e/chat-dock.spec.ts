import { expect, test, type Page } from '@playwright/test';
import { isVisuallyUnobscured } from './panels.js';

const twitchFixture = `<!doctype html><style>
*{box-sizing:border-box}body{margin:0;height:100vh;background:#18181b;color:#efeff1;font:14px Arial;display:flex;flex-direction:column;overflow:hidden}
header{padding:12px;text-align:center;border-bottom:1px solid #343439}#messages{flex:1;min-height:0;overflow:auto;padding:12px}#messages p{margin:0;padding:8px 0;border-bottom:1px solid #303034}
footer{height:76px;flex-shrink:0;padding:8px;border-top:1px solid #343439}input{width:100%;height:28px;background:#222;color:white;border:1px solid #777}button{cursor:pointer}footer button{float:right;margin:4px}
#settings{position:fixed;left:max(0px,calc(100% - 340px));bottom:76px;width:320px;height:310px;padding:16px;background:#27272b;border:1px solid #777}#settings[hidden]{display:none}#settings button{float:right}#settings p{padding:8px 0}
</style><header>External chat fixture</header><div id="messages">${Array.from({ length: 60 }, (_, i) => `<p>Fixture message ${i + 1}</p>`).join('')}</div>
<section id="settings" hidden><button id="close-settings" onclick="document.getElementById('settings').hidden=true">Close settings</button><h3>Chat Settings</h3><p>Chat Filters <span style="float:right">Off</span></p><p>Pause Chat</p><p>Chat Appearance</p><p>Screen Reader</p></section>
<footer><input aria-label="Send a message"><button id="send">Chat</button><button id="open-settings" onclick="document.getElementById('settings').hidden=!document.getElementById('settings').hidden">Chat Settings</button></footer>`;

async function connectedView(page: Page) {
  let iframeLoads = 0;
  await page.route('https://www.twitch.tv/embed/**', (route) => {
    iframeLoads++;
    return route.fulfill({ contentType: 'text/html', body: twitchFixture });
  });
  await page.route('**/api/viewer*', (route) =>
    route.fulfill({ json: { login: null, canManage: false } }),
  );
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  const room = new URL(page.url()).searchParams.get('room')!;
  await page.request.post(`/api/rooms/${room}/control`, {
    headers: { Origin: new URL(page.url()).origin },
    data: { action: 'pause' },
  });
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
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  const frame = page.frameLocator('iframe[title="testchannel Twitch chat"]');
  await expect(frame.getByRole('textbox', { name: 'Send a message' })).toBeVisible();
  const before = (await (await page.request.get(`/api/rooms/${room}`)).json()).game;
  return { frame, room, before, iframeLoads: () => iframeLoads };
}

test('chat settings fit a desktop dock; expand/restore/close retain the draft and match', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { frame, room, before, iframeLoads } = await connectedView(page);
  const input = frame.getByRole('textbox', { name: 'Send a message' });
  await input.fill('Keep this draft');
  await frame.getByRole('button', { name: 'Chat Settings', exact: true }).click();
  expect(
    await frame
      .locator('#settings')
      .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
  ).toBe(true);
  await expect(frame.getByRole('button', { name: 'Close settings' })).toBeInViewport();
  await expect.poll(() => isVisuallyUnobscured(frame.locator('#send'))).toBe(true);
  const dock = page.locator('.live-community');
  const initial = (await dock.boundingBox())!.width;
  expect(initial).toBeGreaterThanOrEqual(400);
  await page.getByRole('button', { name: 'Expand chat', exact: true }).click();
  expect((await dock.boundingBox())!.width).toBeGreaterThan(initial);
  await page.getByRole('button', { name: 'Restore chat size', exact: true }).click();
  await page.getByRole('button', { name: 'Close community panel' }).click();
  await expect(dock).toBeHidden();
  await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(input).toHaveValue('Keep this draft');
  expect(iframeLoads()).toBe(1);
  await expect(page.locator('.live-command-form')).toHaveCount(0);
  expect((await (await page.request.get(`/api/rooms/${room}`)).json()).game).toEqual(before);
});

test('short and phone chat can scroll to controls, expand without occlusion and scroll native messages', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const { frame, iframeLoads } = await connectedView(page);
  const viewport = page.getByRole('region', { name: 'Scrollable Twitch chat' });
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(frame.locator('#send')).toBeInViewport();
  await viewport.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBe(0);
  await page.keyboard.press('End');
  await expect(frame.locator('#send')).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Expand chat', exact: true }).click();
  await frame.getByRole('button', { name: 'Chat Settings', exact: true }).click();
  await expect(frame.locator('#settings')).toBeInViewport({ ratio: 1 });
  await expect.poll(() => isVisuallyUnobscured(frame.locator('#send'))).toBe(true);
  await frame.getByRole('button', { name: 'Close settings' }).click();
  await frame.locator('#messages').hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => frame.locator('#messages').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Restore chat size', exact: true }).click();
  await expect(frame.locator('#send')).toBeInViewport();
  await page.getByRole('button', { name: 'Choose a soldier', exact: true }).click();
  await expect(page.locator('.deployment-dock')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => viewport.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await viewport.focus();
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(frame.locator('#send')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(iframeLoads()).toBe(1);
});
