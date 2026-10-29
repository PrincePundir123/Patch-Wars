import { it, expect } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../apps/server/src/app.js';
it('applies the same origin allowlist to browser sockets and HTTP mutations', async () => {
  const { app } = await buildApp({ webOrigin: 'https://demo.example.test', clock: false });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('No address');
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: 'http://localhost:5173' },
      payload: { mode: 'demo' },
    });
    expect(created.statusCode).toBe(200);
    const id = created.json().id;
    for (const origin of [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://demo.example.test',
    ]) {
      const data = await new Promise<{ roomId: string }>((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/${id}`, { origin });
        socket.on('error', reject);
        socket.once('message', (raw) => {
          resolve(JSON.parse(raw.toString()));
          socket.close();
        });
      });
      expect(data.roomId).toBe(id);
    }
    const code = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/${id}`, {
        origin: 'https://evil.test',
      });
      socket.on('error', reject);
      socket.once('close', resolve);
    });
    expect(code).toBe(1008);
  } finally {
    await app.close();
  }
});
