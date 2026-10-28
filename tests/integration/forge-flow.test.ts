import { it, expect } from 'vitest';
import { Room } from '../../apps/server/src/room.js';
it('replays EventSub-shaped messages through voting, worker validation, simulation and deployment', async () => {
  const r = new Room('owner', 'demo');
  r.channels = [{ id: 'channel-1', name: 'test', team: 'ember', status: 'connected' }];
  r.start();
  const message = (id: string, user: string, text: string) => ({
    broadcaster_user_id: 'channel-1',
    chatter_user_id: user,
    chatter_user_name: 'Viewer',
    message_id: id,
    message: { text },
  });
  expect(
    r.receive(message('1', 'u1', '!forge a slime that splits into three when defeated')),
  ).toContain('accepted');
  r.openVote();
  expect(r.receive(message('2', 'u2', '!vote p1'))).toContain('counted');
  r.launchForge();
  try {
    await expect.poll(() => r.forge?.status, { timeout: 20000 }).toMatch(/approved|rejected/);
    expect(r.forge?.error).toBeUndefined();
    expect(r.forge?.report?.engagements).toBe(200);
    r.game.tick = 540;
    r.tick();
    expect(r.forge?.status).toBe('deployed');
    const unit = r.game.units.find((u) => u.blueprintId === r.forge?.blueprint?.id);
    expect(unit).toBeDefined();
    unit!.hp = 0;
    r.tick();
    expect(r.game.units.filter((u) => u.child)).toHaveLength(3);
    expect(r.snapshot().game.events.some((e) => e.kind === 'split')).toBe(true);
  } finally {
    r.dispose();
  }
});
