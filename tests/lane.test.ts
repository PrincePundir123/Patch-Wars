import { describe, expect, it } from 'vitest';
import {
  CASTLE_X,
  LANE_Y,
  createGame,
  spawn,
  startGame,
  step,
  SLIME,
} from '../packages/game-core/src/index.js';

describe('authoritative castle lane', () => {
  it('spawns at each gate and marches in opposite directions on one lane', () => {
    const s = createGame();
    s.phase = 'battle';
    spawn(s, 'ember', 'guardian', true);
    spawn(s, 'azure', 'archer', true);
    expect(s.units.map((u) => [u.x, u.y])).toEqual([
      [90, LANE_Y],
      [1110, LANE_Y],
    ]);
    step(s, false);
    expect(s.units[0]!.x).toBeGreaterThan(90);
    expect(s.units[1]!.x).toBeLessThan(1110);
    expect(s.units.every((u) => u.y === LANE_Y)).toBe(true);
  });
  it('stops at range without crossing an opponent, then resumes after a kill', () => {
    const s = createGame();
    s.phase = 'battle';
    spawn(s, 'ember', 'archer', true);
    spawn(s, 'azure', 'guardian', true);
    const [a, b] = s.units;
    a!.x = 500;
    b!.x = 500 + s.catalog.archer!.stats.attackRange + 0.1;
    b!.cooldown = 100;
    a!.cooldown = 0;
    step(s, false);
    expect(b!.x - a!.x).toBeGreaterThan(0);
    b!.hp = 1;
    for (let i = 0; i < 50 && s.units.includes(b!); i++) step(s, false);
    expect(s.units.includes(b!)).toBe(false);
    const previous = a!.x;
    step(s, false);
    expect(a!.x).toBeGreaterThan(previous);
  });
  it('does not let friendly ranged units lock reinforcements in the gate', () => {
    const s = createGame();
    s.phase = 'battle';
    spawn(s, 'ember', 'archer', true);
    spawn(s, 'ember', 'sprinter', true);
    s.units[0]!.x = 100;
    for (let i = 0; i < 30; i++) step(s, false);
    expect(s.units[1]!.x).toBeGreaterThan(s.units[0]!.x);
  });
  it('keeps split children on the lane and castle damage authoritative', () => {
    const s = createGame();
    s.phase = 'battle';
    s.catalog.slime = SLIME;
    spawn(s, 'ember', 'slime', true);
    s.units[0]!.hp = 0;
    step(s, false);
    expect(s.units).toHaveLength(3);
    expect(s.units.every((u) => u.y === LANE_Y)).toBe(true);
    s.units = [];
    spawn(s, 'ember', 'guardian', true);
    s.units[0]!.x = CASTLE_X.azure - 1;
    s.units[0]!.cooldown = 0;
    s.bases.azure = 1;
    step(s, false);
    expect(s.winner).toBe('ember');
  });
  it('replays the complete lane battle identically with seeded inputs', () => {
    const run = () => {
      const s = createGame(823, 90);
      startGame(s);
      for (let i = 0; i < 1800; i++) {
        if (i % 200 === 0) spawn(s, 'ember', 'archer');
        step(s);
      }
      return s;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.damage.ember + a.damage.azure).toBeGreaterThan(0);
  });
});
