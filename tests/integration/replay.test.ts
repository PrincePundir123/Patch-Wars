import { it, expect } from 'vitest';
import { setTimeout } from 'node:timers/promises';
import { Room } from '../../apps/server/src/room.js';
it('reproduces the complete replay including forge, split, raid and victory after reset', async () => {
  const r = new Room('owner', 'demo');
  const run = async () => {
    r.start();
    let split = false;
    for (let n = 0; r.game.phase !== 'results' && n < 6000; n++) {
      r.tick();
      split ||= r.game.events.some((e) => e.kind === 'split');
      if (r.game.tick === 539 || r.game.tick === 540) await setTimeout(10);
    }
    expect(r.game.phase).toBe('results');
    expect(r.forge?.status).toBe('deployed');
    expect(split).toBe(true);
    expect(r.timeline.some((e) => e.text.includes('Simulated raid'))).toBe(true);
    return JSON.stringify(r.game);
  };
  try {
    const first = await run();
    r.reset();
    expect(await run()).toEqual(first);
  } finally {
    r.dispose();
  }
});
