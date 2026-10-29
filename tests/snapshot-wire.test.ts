import { it, expect } from 'vitest';
import { Room } from '../apps/server/src/room.js';
import { compactSnapshot, createSnapshotDecoder } from '../packages/shared/src/snapshot-wire.js';

it('rehydrates identical snapshots, reuses the catalog and requires a fresh catalog after reconnect', () => {
  const room = new Room('owner', 'demo');
  try {
    room.start();
    const full = JSON.parse(JSON.stringify(room.snapshot()));
    const decode = createSnapshotDecoder();
    const first = decode(full);
    const compact = JSON.parse(JSON.stringify(compactSnapshot(full)));
    const next = decode(compact);
    expect(next).toEqual(first);
    expect(next.game.catalog).toBe(first.game.catalog);
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(full).length);
    expect(() => createSnapshotDecoder()(compact)).toThrow('initial catalog');
    const changed = structuredClone(full);
    changed.game.catalog.guardian.name = 'Updated guardian';
    expect(decode(changed).game.catalog.guardian!.name).toBe('Updated guardian');
  } finally {
    room.dispose();
  }
});
