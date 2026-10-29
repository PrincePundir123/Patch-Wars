import { it, expect, vi } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../apps/server/src/app.js';
import type { SnapshotFrame } from '../../packages/shared/src/snapshot-wire.js';

it('keeps legacy sockets full and refreshes compact catalogs on change, reset and reconnect', async () => {
  const { app, rooms } = await buildApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('No address');
  const created = await app.inject({
    method: 'POST',
    url: '/api/rooms',
    headers: { origin: 'http://localhost:5173' },
    payload: { mode: 'demo' },
  });
  const id = created.json().id;
  const base = `ws://127.0.0.1:${address.port}/ws/${id}`;
  const frames: SnapshotFrame[] = [],
    legacyFrames: SnapshotFrame[] = [];
  const socket = new WebSocket(base + '?format=compact');
  const legacy = new WebSocket(base);
  socket.on('message', (data) => frames.push(JSON.parse(data.toString())));
  legacy.on('message', (data) => legacyFrames.push(JSON.parse(data.toString())));
  try {
    await vi.waitFor(() => expect(frames.some((f) => !f.game.catalog)).toBe(true));
    expect(frames[0]!.game.catalog?.guardian).toBeDefined();
    expect(legacyFrames.every((f) => !!f.game.catalog)).toBe(true);
    const room = rooms.get(id)!;
    room.game.catalog['test-guardian'] = { ...room.game.catalog.guardian!, id: 'test-guardian' };
    await vi.waitFor(() =>
      expect(frames.some((f) => !!f.game.catalog?.['test-guardian'])).toBe(true),
    );
    const beforeReset = frames.length;
    room.reset();
    await vi.waitFor(() =>
      expect(
        frames.slice(beforeReset).some((f) => f.game.catalog && !f.game.catalog['test-guardian']),
      ).toBe(true),
    );
    socket.close();
    const reconnected = new WebSocket(base + '?format=compact');
    const first = await new Promise<SnapshotFrame>((resolve, reject) => {
      reconnected.once('message', (data) => resolve(JSON.parse(data.toString())));
      reconnected.once('error', reject);
    });
    expect(first.game.catalog?.guardian).toBeDefined();
    reconnected.close();
  } finally {
    socket.close();
    legacy.close();
    await app.close();
  }
});
