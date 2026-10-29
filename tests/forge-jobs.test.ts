import { EventEmitter } from 'node:events';
import { afterEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({
  workers: [] as {
    emit: (event: string, ...args: unknown[]) => boolean;
    terminate: () => Promise<number>;
  }[],
}));
vi.mock('node:worker_threads', () => ({
  Worker: class extends EventEmitter {
    terminate = vi.fn(async () => 0);
    constructor() {
      super();
      state.workers.push(this);
    }
  },
}));
import { Room } from '../apps/server/src/room.js';
import { SLIME, spawn, MAX_ENTITIES } from '../packages/game-core/src/index.js';
afterEach(() => {
  vi.useRealTimers();
  state.workers.length = 0;
});
function ready(maxJobs = 12, timeout = 90000) {
  const r = new Room('owner', 'demo', 'fixture', maxJobs, timeout);
  r.start();
  r.demoCommand('!forge a splitting slime', 'ember', 'viewer');
  r.openVote();
  return r;
}
const approved = {
  status: 'approved',
  blueprint: SLIME,
  report: {
    passed: true,
    engagements: 200,
    winRate: 0.42,
    durationMs: 100,
    peakEntities: 20,
    damageDealt: 100,
    damageReceived: 100,
    meanLifespanTicks: 500,
    efficiency: 1,
  },
  attempt: 1,
};
describe('Forge job lifecycle', () => {
  it('gives a live approved unit three simulation seconds for its reveal', () => {
    const r = ready();
    r.mode = 'live';
    r.launchForge();
    state.workers[0]!.emit('message', approved);
    expect(r.forge?.deploymentTick).toBe(60);
    for (let i = 0; i < 59; i++) r.tick();
    expect(r.forge?.status).toBe('approved');
    r.paused = true;
    r.tick();
    expect(r.game.tick).toBe(59);
    r.paused = false;
    r.tick();
    expect(r.forge?.status).toBe('deployed');
    r.dispose();
  });
  it('rejects timeout and ignores a late approval from the cancelled worker', async () => {
    vi.useFakeTimers();
    const r = ready(12, 10);
    r.launchForge();
    const worker = state.workers[0]!;
    await vi.advanceTimersByTimeAsync(1011);
    expect(r.forge?.status).toBe('rejected');
    expect(r.forge?.error).toContain('timed out');
    worker.emit('message', approved);
    expect(r.forge?.status).toBe('rejected');
    expect(worker.terminate).toHaveBeenCalled();
    r.dispose();
  });
  it('enforces generation quota before starting work', () => {
    const r = ready(0);
    r.launchForge();
    expect(r.forge?.error).toContain('quota');
    expect(state.workers).toHaveLength(0);
    r.dispose();
  });
  it('starts one worker and safely rejects its error', () => {
    const r = ready();
    r.launchForge();
    r.launchForge();
    expect(state.workers).toHaveLength(1);
    state.workers[0]!.emit('error', new Error('worker failed'));
    expect(r.forge?.status).toBe('rejected');
    r.tick();
    expect(r.game.tick).toBe(1);
    r.dispose();
  });
  it('revalidates an allegedly approved worker result', () => {
    const r = ready();
    r.launchForge();
    state.workers[0]!.emit('message', {
      ...approved,
      blueprint: { ...SLIME, stats: { ...SLIME.stats, maxHealth: 1e9 } },
    });
    expect(r.forge?.status).toBe('rejected');
    r.dispose();
  });
  it('waits for entity capacity before announcing deployment', () => {
    const r = ready();
    r.launchForge();
    state.workers[0]!.emit('message', approved);
    while (r.game.units.length < MAX_ENTITIES) spawn(r.game, 'ember', 'guardian', true);
    r.game.tick = 540;
    r.tick();
    expect(r.forge?.status).toBe('approved');
    r.game.units.splice(0, 2);
    r.tick();
    expect(r.forge?.status).toBe('deployed');
    r.dispose();
  });
});
