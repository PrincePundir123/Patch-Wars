import { it, expect } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../apps/server/src/app.js';
it('recovers authoritative snapshots on reconnect and rejects socket mutations', async () => {
  const { app } = await buildApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  const created = await app.inject({
    method: 'POST',
    url: '/api/rooms',
    headers: { origin: 'http://localhost:5173' },
    payload: { mode: 'demo' },
  });
  const id = created.json().id;
  const cookie = created.headers['set-cookie']!.toString().split(';')[0]!;
  await app.inject({
    method: 'POST',
    url: `/api/rooms/${id}/control`,
    headers: { origin: 'http://localhost:5173', cookie },
    payload: { action: 'start' },
  });
  const read = () =>
    new Promise<{ seq: number; socket: WebSocket }>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/${id}`);
      socket.once('message', (data) => resolve({ seq: JSON.parse(data.toString()).seq, socket }));
    });
  try {
    const first = await read();
    first.socket.close();
    const second = await read();
    expect(second.seq).toBeGreaterThan(first.seq);
    const closed = new Promise<number>((resolve) => second.socket.once('close', resolve));
    second.socket.send(JSON.stringify({ damage: 999 }));
    expect(await closed).toBe(1008);
  } finally {
    await app.close();
  }
});
