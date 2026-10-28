import { describe, it, expect } from 'vitest';
import {
  createGame,
  startGame,
  step,
  spawn,
  SLIME,
  MAX_ENTITIES,
} from '../packages/game-core/src/index.js';
describe('deterministic battle', () => {
  it('applies bounded shield absorption and slow on hit', () => {
    const s = createGame();
    s.phase = 'battle';
    s.catalog.frost = {
      ...SLIME,
      id: 'frost',
      abilities: [{ op: 'slow', event: 'hit', duration: 30 }],
    };
    s.catalog.shield = {
      ...SLIME,
      id: 'shield',
      abilities: [{ op: 'shield', event: 'spawn', amount: 30 }],
    };
    spawn(s, 'ember', 'frost', true);
    spawn(s, 'azure', 'shield', true);
    const [a, b] = s.units;
    a!.x = 600;
    a!.y = 270;
    a!.cooldown = 0;
    b!.x = 610;
    b!.y = 270;
    b!.cooldown = 20;
    step(s, false);
    expect(b!.shield).toBe(22);
    expect(b!.hp).toBe(b!.maxHp);
    expect(b!.slowUntil).toBe(31);
  });
  it('respects attack cooldown and range', () => {
    const s = createGame();
    s.phase = 'battle';
    spawn(s, 'ember', 'guardian', true);
    spawn(s, 'azure', 'guardian', true);
    const [a, b] = s.units;
    a!.cooldown = 0;
    b!.cooldown = 20;
    step(s, false);
    expect(b!.hp).toBe(b!.maxHp);
    a!.x = 600;
    b!.x = 610;
    a!.y = b!.y = 270;
    a!.cooldown = 10;
    step(s, false);
    expect(b!.hp).toBe(b!.maxHp);
    a!.cooldown = 0;
    step(s, false);
    expect(b!.hp).toBeLessThan(b!.maxHp);
  });
  it('damages the opposing base and determines victory', () => {
    const s = createGame();
    s.phase = 'battle';
    spawn(s, 'ember', 'guardian', true);
    s.units[0]!.x = 1130;
    s.units[0]!.y = 270;
    s.units[0]!.cooldown = 0;
    s.bases.azure = 1;
    step(s, false);
    expect(s.bases.azure).toBe(0);
    expect(s.winner).toBe('ember');
  });
  it('reproduces movement, combat and final result from seed', () => {
    const run = () => {
      const s = createGame(42, 60);
      startGame(s);
      for (let i = 0; i < 1200; i++) step(s);
      return s;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.phase).toBe('results');
    expect(a.damage.ember + a.damage.azure).toBeGreaterThan(0);
    expect(a.scores.ember + a.scores.azure).toBeGreaterThan(0);
  });
  it('splits once and never recursively', () => {
    const s = createGame();
    s.phase = 'battle';
    s.catalog[SLIME.id] = SLIME;
    spawn(s, 'ember', SLIME.id, true);
    s.units[0]!.hp = 0;
    step(s, false);
    expect(s.units).toHaveLength(3);
    expect(s.units.every((u) => u.child)).toBe(true);
    for (const u of s.units) u.hp = 0;
    step(s, false);
    expect(s.units).toHaveLength(0);
  });
  it('enforces costs and entity budget', () => {
    const s = createGame();
    s.energy.ember = 0;
    expect(spawn(s, 'ember', 'guardian')).toBe(false);
    for (let i = 0; i < 300; i++) spawn(s, 'ember', 'guardian', true);
    expect(s.units).toHaveLength(MAX_ENTITIES);
  });
  it('heals and shields within limits', () => {
    const s = createGame();
    s.phase = 'battle';
    spawn(s, 'ember', 'healer', true);
    spawn(s, 'ember', 'guardian', true);
    s.units[1]!.x = s.units[0]!.x;
    s.units[1]!.y = s.units[0]!.y;
    s.units[1]!.hp = 40;
    s.tick = 29;
    step(s, false);
    expect(s.units[1]!.hp).toBe(48);
  });
  it('finishes a tie without nondeterministic coin flips', () => {
    const s = createGame(1, 1);
    s.phase = 'battle';
    for (let i = 0; i < 20; i++) step(s, false);
    expect(s.winner).toBe('draw');
  });
});
