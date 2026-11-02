import { describe, expect, it } from 'vitest';
import { STARTERS, SLIME } from '../packages/game-core/src/catalog.js';
import { makeSigil, seedOf, sketchFromIdea } from '../apps/web/src/sigil.js';
import { estimateEarnings, STREAMER_CENTS_PER_BIT } from '../apps/web/src/StreamerValue.js';

describe('Forge sigils', () => {
  it('draws the same crest for the same blueprint on every screen', () => {
    for (const b of [...STARTERS, SLIME]) expect(makeSigil(b)).toEqual(makeSigil({ ...b }));
  });

  it('gives starter units distinct crests', () => {
    const seeds = new Set([...STARTERS, SLIME].map((b) => makeSigil(b).seed));
    expect(seeds.size).toBe(STARTERS.length + 1);
  });

  it('maps archetype to the charge and abilities to the marks', () => {
    const sigil = makeSigil({ ...SLIME });
    expect(sigil.charge).toBe('egg');
    expect(sigil.marks).toContain('split');
    expect(sigil.marks.length).toBeLessThanOrEqual(3);
  });

  it('reads a free-text idea without executing or echoing markup', () => {
    const sketch = sketchFromIdea('<script>alert(1)</script> frost healer', 'azure');
    expect(sketch.archetype).toBe('support');
    expect(sketch.abilities.map((a) => a.op)).toEqual(['slow', 'heal']);
    expect(sketch.name.length).toBeLessThanOrEqual(32);
    expect(seedOf('a')).not.toBe(seedOf('b'));
  });
});

describe('Bits estimator', () => {
  it('uses the fixed product prices and the broadcaster share per Bit', () => {
    const e = estimateEarnings(300, 6, 3, 12);
    expect(e.deployments).toBe(54);
    expect(e.bits).toBe(54 * 30);
    expect(e.perStream).toBeCloseTo((1620 * STREAMER_CENTS_PER_BIT) / 100);
    expect(e.perMonth).toBeCloseTo(e.perStream * 12);
  });
});
