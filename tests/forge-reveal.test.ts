import { it, expect } from 'vitest';
import { abilityText } from '../apps/web/src/ForgeReveal.js';
it('explains generated abilities in gameplay terms', () => {
  expect(abilityText({ op: 'split', event: 'death', count: 3, scale: 0.3 })).toContain(
    'Children cannot split',
  );
  expect(abilityText({ op: 'slow', event: 'hit', duration: 30 })).toContain('1.5 seconds');
  expect(abilityText({ op: 'heal', event: 'tick', amount: 8, radius: 100, every: 30 })).toContain(
    'every 1.5 seconds',
  );
});
