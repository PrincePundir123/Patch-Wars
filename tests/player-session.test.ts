import { afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../apps/server/src/app.js';
import { EventSubClient, TwitchIdentity } from '../packages/twitch-adapter/src/index.js';
const origin = 'http://localhost:5173',
  key = 'local-player-test-key-long-enough';
afterEach(() => vi.restoreAllMocks());
async function connectedHost() {
  vi.spyOn(TwitchIdentity.prototype, 'exchange').mockImplementation(async function (
    this: TwitchIdentity,
  ) {
    this.userId = '100';
    this.login = 'streamer';
  });
  vi.spyOn(EventSubClient.prototype, 'start').mockImplementation(() => {});
  vi.spyOn(TwitchIdentity.prototype, 'revoke').mockResolvedValue();
  const built = await buildApp({
    clock: false,
    provider: 'fixture',
    adminKey: key,
    twitch: {
      clientId: 'test-client',
      clientSecret: 'test-secret',
      redirectUri: origin + '/auth/twitch/callback',
    },
  });
  const session = await built.app.inject({
    method: 'POST',
    url: '/api/session',
    headers: { origin },
    payload: { key },
  });
  const cookie = session.headers['set-cookie']!.toString().split(';')[0]!;
  const created = await built.app.inject({
    method: 'POST',
    url: '/api/rooms',
    headers: { origin, cookie },
    payload: { mode: 'live' },
  });
  const room = built.rooms.get(created.json().id)!;
  const auth = await built.app.inject({
    url: `/auth/twitch?room=${room.id}&origin=${encodeURIComponent(origin)}`,
    headers: { cookie },
  });
  const state = new URL(auth.headers.location!).searchParams.get('state');
  await built.app.inject({
    url: `/auth/twitch/callback?code=host-code&state=${state}`,
    headers: { cookie },
  });
  room.channels[0]!.status = 'connected';
  room.start();
  return { ...built, cookie, room };
}
it('reuses only the session that authorized a channel, without giving visitors player or host access', async () => {
  const { app, room, cookie } = await connectedHost();
  try {
    expect(
      (await app.inject({ url: `/api/viewer?room=${room.id}`, headers: { cookie } })).json(),
    ).toEqual({ login: 'streamer', source: 'channel', canManage: true });
    expect((await app.inject(`/api/viewer?room=${room.id}`)).json()).toEqual({
      login: null,
      source: null,
      canManage: false,
    });
    const sent = await app.inject({
      method: 'POST',
      url: `/api/rooms/${room.id}/viewer-command`,
      headers: { origin, cookie },
      payload: { channelId: '100', text: '!spawn archer' },
    });
    expect(sent.json().message).toBe('Archer deployed.');
    expect(room.game.units.at(-1)).toMatchObject({ team: 'ember', blueprintId: 'archer' });
    const other = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin },
      payload: { key },
    });
    const otherCookie = other.headers['set-cookie']!.toString().split(';')[0]!;
    expect(
      (
        await app.inject({ url: `/api/viewer?room=${room.id}`, headers: { cookie: otherCookie } })
      ).json(),
    ).toEqual({ login: null, source: null, canManage: false });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/viewer-command`,
          headers: { origin, cookie: otherCookie },
          payload: { channelId: '100', text: '!spawn archer' },
        })
      ).statusCode,
    ).toBe(401);
  } finally {
    await app.close();
  }
});
it('sends real chat through the transport once and lets only EventSub execute game commands, including after rematch', async () => {
  const send = vi
    .spyOn(TwitchIdentity.prototype, 'sendChat')
    .mockResolvedValue({ messageId: 'sent-message' });
  const { app, room, cookie } = await connectedHost();
  try {
    const before = room.game.units.length;
    const result = await app.inject({
      method: 'POST',
      url: `/api/rooms/${room.id}/chat`,
      headers: { origin, cookie },
      payload: { channelId: '100', text: '!spawn archer' },
    });
    expect(result.json()).toEqual({
      message: 'Message sent to Twitch.',
      messageId: 'sent-message',
    });
    expect(send).toHaveBeenCalledWith('100', '!spawn archer');
    expect(room.game.units).toHaveLength(before);
    const event = {
      broadcaster_user_id: '100',
      chatter_user_id: '100',
      chatter_user_name: 'streamer',
      message_id: 'sent-message',
      message: { text: '!spawn archer' },
    };
    expect(room.receive(event)).toBe('Archer deployed.');
    expect(room.game.units).toHaveLength(before + 1);
    expect(room.receive(event)).toBe('Duplicate event ignored.');
    expect(room.game.units).toHaveLength(before + 1);
    room.game.phase = 'results';
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/chat`,
          headers: { origin, cookie },
          payload: { channelId: '100', text: 'good game' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/control`,
          headers: { origin, cookie },
          payload: { action: 'reset' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/control`,
          headers: { origin, cookie },
          payload: { action: 'start' },
        })
      ).statusCode,
    ).toBe(200);
    expect(room.channels[0]).toMatchObject({ id: '100', status: 'connected' });
    expect(room.game.phase).toBe('battle');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/chat`,
          headers: { origin, cookie },
          payload: { channelId: '999', text: 'wrong channel' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/chat`,
          headers: { origin: 'https://evil.test', cookie },
          payload: { channelId: '100', text: 'forged' },
        })
      ).statusCode,
    ).toBe(403);
    send.mockRejectedValueOnce(new Error('Twitch held this message for moderation.'));
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${room.id}/chat`,
          headers: { origin, cookie },
          payload: { channelId: '100', text: 'held' },
        })
      ).json().error,
    ).toContain('moderation');
  } finally {
    await app.close();
  }
});
it('expires invalid player authorization instead of continuing to advertise a usable login', async () => {
  const { app, room, cookie } = await connectedHost();
  try {
    vi.spyOn(TwitchIdentity.prototype, 'validate').mockRejectedValue(new Error('revoked'));
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 301000);
    const sent = await app.inject({
      method: 'POST',
      url: `/api/rooms/${room.id}/viewer-command`,
      headers: { origin, cookie },
      payload: { channelId: '100', text: '!spawn archer' },
    });
    expect(sent.statusCode).toBe(401);
    expect(sent.json().error).toContain('expired');
    expect(
      (await app.inject({ url: `/api/viewer?room=${room.id}`, headers: { cookie } })).json().login,
    ).toBeNull();
  } finally {
    await app.close();
  }
});
