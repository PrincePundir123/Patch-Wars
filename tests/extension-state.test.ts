import { expect, it } from 'vitest';
import { STARTERS } from '../packages/game-core/src/catalog.js';
import { readExtensionState, readCommandResult } from '../apps/extension/state.js';
const state = {
  roomId: '00000000-0000-4000-8000-000000000001',
  team: 'ember',
  phase: 'battle',
  paused: false,
  commandsEnabled: true,
  linked: true,
  energy: 30,
  catalog: Object.fromEntries(STARTERS.map((b) => [b.id, b])),
};
it('validates and narrows extension display data without changing unit costs', () => {
  const parsed = readExtensionState(state);
  expect(parsed.catalog.archer!.stats.spawnCost).toBe(
    STARTERS.find((b) => b.id === 'archer')!.stats.spawnCost,
  );
  expect(readCommandResult({ message: 'Archer deployed.' })).toBe('Archer deployed.');
  for (const bad of [
    { ...state, energy: Infinity },
    { ...state, team: 'attacker' },
    { ...state, linked: 'true' },
    { ...state, catalog: { fake: STARTERS[0] } },
    {
      ...state,
      catalog: { ...state.catalog, archer: { ...state.catalog.archer, stats: { spawnCost: -1 } } },
    },
  ])
    expect(() => readExtensionState(bad)).toThrow('invalid display state');
  expect(() => readCommandResult({ message: { unsafe: true } })).toThrow();
});
