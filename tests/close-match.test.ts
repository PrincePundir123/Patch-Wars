import { expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../apps/server/src/app.js';
const origin = 'http://localhost:5173';
it('only the owner can close a match; closing frees its slot and ends spectator sockets', async () => {
  const { app, rooms } = await buildApp({ clock: false, provider: 'fixture' });
  let socket: WebSocket | undefined;
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin },
      payload: { mode: 'demo' },
    });
    const cookie = created.headers['set-cookie']!.toString().split(';')[0]!;
    const id = created.json().id;
    const room = rooms.get(id)!;
    const dispose = vi.spyOn(room, 'dispose');
    for (let i = 0; i < 3; i++)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/rooms',
            headers: { origin, cookie },
            payload: { mode: 'demo' },
          })
        ).statusCode,
      ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/rooms',
          headers: { origin, cookie },
          payload: { mode: 'demo' },
        })
      ).json().error,
    ).toContain('four matches');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${id}/close`,
          headers: { origin },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${id}/close`,
          headers: { origin: 'https://evil.test', cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(rooms.size).toBe(4);
    expect(dispose).not.toHaveBeenCalled();
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/${id}`);
    await new Promise<void>((resolve, reject) => {
      socket!.once('message', () => resolve());
      socket!.once('error', reject);
    });
    const closed = new Promise<number>((resolve) => socket!.once('close', (code) => resolve(code)));
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${id}/close`,
          headers: { origin, cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(200);
    expect(await closed).toBe(1008);
    expect(dispose).toHaveBeenCalledOnce();
    expect(rooms.size).toBe(3);
    expect((await app.inject(`/api/rooms/${id}`)).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/rooms',
          headers: { origin, cookie },
          payload: { mode: 'demo' },
        })
      ).statusCode,
    ).toBe(200);
    expect(rooms.size).toBe(4);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/rooms/${id}/close`,
          headers: { origin, cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(404);
  } finally {
    socket?.terminate();
    await app.close();
  }
});
