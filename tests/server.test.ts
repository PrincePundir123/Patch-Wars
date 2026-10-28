import { describe, it, expect } from 'vitest';
import { buildApp, consumeState } from '../apps/server/src/app.js';
const origin = 'http://localhost:5173';
describe('server authorization', () => {
  it('creates an owned demo, refuses spectator mutations and forged origins', async () => {
    const { app } = await buildApp({ clock: false });
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { origin },
        payload: { mode: 'demo' },
      });
      expect(created.statusCode).toBe(200);
      const id = created.json().id;
      const cookie = created.headers['set-cookie']!.toString().split(';')[0]!;
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/rooms/${id}/control`,
            headers: { origin },
            payload: { action: 'start' },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/rooms/${id}/control`,
            headers: { origin: 'https://evil.test', cookie },
            payload: { action: 'start' },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/rooms/${id}/control`,
            headers: { origin, cookie },
            payload: { action: 'start' },
          })
        ).statusCode,
      ).toBe(200);
      expect((await app.inject(`/api/rooms/${id}`)).json().game.phase).toBe('battle');
    } finally {
      await app.close();
    }
  });
  it('requires operator access for live rooms', async () => {
    const { app } = await buildApp({ clock: false });
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/rooms',
            headers: { origin },
            payload: { mode: 'live' },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
  it('rejects OAuth state mismatch, expiry and replay', () => {
    const state = { session: 'a', roomId: 'r', team: 'ember' as const, expires: 100 };
    const values = new Map([['token', state]]);
    expect(() => consumeState(values, 'token', 'b', 0)).toThrow();
    expect(() => consumeState(values, 'token', 'a', 0)).toThrow();
    expect(() => consumeState(new Map([['t', state]]), 't', 'a', 101)).toThrow();
    expect(consumeState(new Map([['t', state]]), 't', 'a', 1)).toEqual(state);
  });
});
