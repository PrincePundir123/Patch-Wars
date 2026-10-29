import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../apps/server/src/app.js';
import { verifyExtensionToken } from '../apps/server/src/extension-auth.js';
import { TwitchIdentity } from '../packages/twitch-adapter/src/index.js';

const origin = 'http://localhost:5173';
const secret = Buffer.alloc(32, 7).toString('base64');
const extOrigin = 'https://testextension.ext-twitch.tv';
const claims = {
  exp: Math.floor(Date.now() / 1000) + 3600,
  channel_id: '100',
  user_id: '200',
  opaque_user_id: 'U200',
  role: 'viewer',
};
function token(payload: object = claims, key = secret, algorithm = 'HS256') {
  const unsigned = `${Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  return `${unsigned}.${createHmac('sha256', Buffer.from(key, 'base64')).update(unsigned).digest('base64url')}`;
}
afterEach(() => vi.restoreAllMocks());
it('validates extension signatures, expiration, roles and linked claims without trusting browser fields', () => {
  expect(verifyExtensionToken(token(), secret).user_id).toBe('200');
  for (const bad of [
    token({ ...claims, exp: 1 }),
    token({ ...claims, role: 'external' }),
    token(claims, Buffer.alloc(32, 8).toString('base64')),
    token(claims, secret, 'none'),
    'garbage',
  ])
    expect(() => verifyExtensionToken(bad, secret)).toThrow('authentication failed');
});

async function setup() {
  const built = await buildApp({
    clock: false,
    provider: 'fixture',
    adminKey: 'long-local-test-key-only',
    extension: { clientId: 'testextension', secret },
    twitch: {
      clientId: 'oauth-client',
      clientSecret: 'test-secret',
      redirectUri: origin + '/auth/twitch/callback',
    },
  });
  const unlock = await built.app.inject({
    method: 'POST',
    url: '/api/session',
    headers: { origin },
    payload: { key: 'long-local-test-key-only' },
  });
  const cookie = unlock.headers['set-cookie']!.toString().split(';')[0]!;
  const created = await built.app.inject({
    method: 'POST',
    url: '/api/rooms',
    headers: { origin, cookie },
    payload: { mode: 'live' },
  });
  const room = built.rooms.get(created.json().id)!;
  room.channels = [{ id: '100', name: 'streamer', team: 'ember', status: 'connected' }];
  room.start();
  return { ...built, room, cookie };
}
it('native unit buttons use the real command handler, fixed channel team, shared cooldown and deduplication', async () => {
  const { app, room } = await setup();
  const headers = { origin: extOrigin, authorization: `Bearer ${token()}` };
  try {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/extension/command',
      headers: { origin: extOrigin },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(extOrigin);
    const state = await app.inject({ url: '/api/extension/state', headers });
    expect(state.json()).toMatchObject({ team: 'ember', roomId: room.id, linked: true });
    const body = { roomId: room.id, text: '!spawn archer', requestId: randomUUID() };
    const energy = room.game.energy.ember;
    expect(
      (
        await app.inject({ method: 'POST', url: '/api/extension/command', headers, payload: body })
      ).json().message,
    ).toBe('Archer deployed.');
    expect(room.game.units.at(-1)).toMatchObject({ blueprintId: 'archer', team: 'ember' });
    expect(room.commandFeedback[0]!.source).toBe('extension');
    expect(room.game.energy.ember).toBe(energy - room.game.catalog.archer!.stats.spawnCost);
    const count = room.game.units.length;
    expect(
      (
        await app.inject({ method: 'POST', url: '/api/extension/command', headers, payload: body })
      ).json().message,
    ).toBe('Duplicate event ignored.');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/extension/command',
          headers,
          payload: { ...body, requestId: randomUUID() },
        })
      ).json().message,
    ).toContain('cooldown');
    expect(room.game.units).toHaveLength(count);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/extension/command',
          headers,
          payload: { ...body, team: 'azure' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/control`,
          headers,
          payload: { action: 'reset' },
        })
      ).statusCode,
    ).toBe(403);
  } finally {
    await app.close();
  }
});
it('rejects anonymous, wrong-channel, forged-origin and disabled extension actions', async () => {
  const { app, room } = await setup();
  try {
    const body = { roomId: room.id, text: '!spawn archer', requestId: randomUUID() };
    for (const [jwt, code] of [
      [token({ ...claims, user_id: undefined }), 403],
      [token({ ...claims, channel_id: '999' }), 409],
      ['fake', 401],
    ] as const) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/extension/command',
            headers: { origin: extOrigin, authorization: `Bearer ${jwt}` },
            payload: body,
          })
        ).statusCode,
      ).toBe(code);
    }
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/extension/command',
          headers: { origin: 'https://evil.test', authorization: `Bearer ${token()}` },
          payload: body,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'OPTIONS',
          url: '/api/extension/command',
          headers: { origin: 'https://evil.test' },
        })
      ).headers['access-control-allow-origin'],
    ).toBeUndefined();
    const protectedRoute = await app.inject('/api/me');
    expect(protectedRoute.headers['content-security-policy']).toContain("frame-ancestors 'self'");
  } finally {
    await app.close();
  }
  const disabled = await buildApp({ clock: false, extension: { clientId: '', secret: '' } });
  try {
    expect(
      (
        await disabled.app.inject({
          url: '/api/extension/state',
          headers: { authorization: `Bearer ${token()}` },
        })
      ).statusCode,
    ).toBe(503);
  } finally {
    await disabled.app.close();
  }
});
it('viewer OAuth binds its callback to a session and grants only player commands, never host ownership', async () => {
  vi.spyOn(TwitchIdentity.prototype, 'exchange').mockImplementation(async function (
    this: TwitchIdentity,
  ) {
    this.userId = '200';
    this.login = 'testviewer';
  });
  vi.spyOn(TwitchIdentity.prototype, 'revoke').mockResolvedValue();
  const { app, room } = await setup();
  try {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/viewer-command`,
          headers: { origin },
          payload: { text: '!spawn archer', channelId: '100' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await app.inject(`/auth/twitch/viewer?room=${room.id}&origin=https://evil.test`)).statusCode,
    ).toBe(403);
    const start = await app.inject(
      `/auth/twitch/viewer?room=${room.id}&origin=${encodeURIComponent(origin)}`,
    );
    const cookie = start.headers['set-cookie']!.toString().split(';')[0]!;
    const state = new URL(start.headers.location!).searchParams.get('state');
    const callback = await app.inject({
      url: `/auth/twitch/callback?code=test&state=${state}`,
      headers: { cookie },
    });
    expect(callback.headers.location).toBe(`/play/${room.id}`);
    expect((await app.inject({ url: '/api/viewer', headers: { cookie } })).json()).toEqual({
      login: 'testviewer',
    });
    expect((await app.inject({ url: '/api/me', headers: { cookie } })).json().operator).toBe(false);
    expect(room.channels).toHaveLength(1);
    expect(room.channels[0]!.id).toBe('100');
    const headers = { origin, cookie };
    const sent = await app.inject({
      method: 'POST',
      url: `/api/rooms/${room.id}/viewer-command`,
      headers,
      payload: { text: '!spawn archer', channelId: '100' },
    });
    expect(sent.json().message).toBe('Archer deployed.');
    expect(room.commandFeedback[0]!.source).toBe('viewer');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/control`,
          headers,
          payload: { action: 'reset' },
        })
      ).statusCode,
    ).toBe(403);
    await app.inject({ method: 'POST', url: '/api/viewer/logout', headers, payload: {} });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/viewer-command`,
          headers,
          payload: { text: '!spawn archer', channelId: '100' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: `/auth/twitch/callback?code=test&state=${state}`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    await app.close();
  }
});
