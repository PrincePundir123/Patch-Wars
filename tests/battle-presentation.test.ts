import { describe, expect, it } from 'vitest';
import atlas from '../apps/web/src/art/sunstone-units.json';
import {
  perspectiveScale,
  projectToArena,
  soldierPose,
  soldierRow,
} from '../apps/web/src/battle-presentation.js';

describe('Sunstone presentation preserves combat coordinates and readable motion', () => {
  it('keeps every team/pose rectangle within the real atlas and aligned to a common foot anchor', () => {
    expect(atlas.frames).toHaveLength(72);
    const ids = new Set<string>();
    for (const cell of atlas.frames) {
      ids.add(cell.id);
      expect(cell.frame.x).toBeGreaterThanOrEqual(0);
      expect(cell.frame.y).toBeGreaterThanOrEqual(0);
      expect(cell.frame.x + cell.frame.width).toBeLessThanOrEqual(atlas.width);
      expect(cell.frame.y + cell.frame.height).toBeLessThanOrEqual(atlas.height);
      expect(cell.trim.x + cell.trim.width).toBeLessThanOrEqual(cell.orig.width);
      expect(cell.trim.y + cell.trim.height).toBeLessThanOrEqual(cell.orig.height);
      expect(cell.anchor).toEqual(atlas.anchor);
    }
    expect(ids.size).toBe(72);
  });
  it('maps both teams into the walkable court while preserving order and shared targets', () => {
    const positions = [
      { x: 60, y: 80 },
      { x: 600, y: 270 },
      { x: 1140, y: 460 },
    ];
    const original = structuredClone(positions);
    const projected = positions.map(({ x, y }) => projectToArena(x, y));
    expect(positions).toEqual(original);
    expect(projected[0]!.x).toBeLessThan(projected[1]!.x);
    expect(projected[1]!.x).toBeLessThan(projected[2]!.x);
    for (const point of projected) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(1200);
      expect(point.y).toBeGreaterThan(160);
      expect(point.y).toBeLessThan(540);
    }
    for (const { x, y } of positions) {
      const point = projectToArena(x, y, true);
      expect(point.x).toBeGreaterThan(40);
      expect(point.x).toBeLessThan(680);
      expect(point.y).toBeGreaterThanOrEqual(300);
      expect(point.y).toBeLessThan(800);
    }
  });
  it('ties stride to distance, stops gait at rest and suppresses motion when requested', () => {
    const moving = { distance: 6, moving: true, attackAge: 100, cooldown: 10, reduced: false };
    expect(soldierPose(moving).frame).toBe(1);
    expect(soldierPose({ ...moving, distance: 18 }).frame).toBe(2);
    expect(soldierPose({ ...moving, moving: false }).lift).toBe(0);
    expect(soldierPose({ ...moving, reduced: true })).toEqual({
      frame: 0,
      lift: 0,
      lean: 0,
      reach: 0,
    });
    expect(soldierPose({ ...moving, attackAge: 1 }).frame).toBe(4);
    expect(soldierPose({ ...moving, attackAge: 5 }).frame).toBe(5);
    expect(soldierPose({ ...moving, moving: false, cooldown: 3 }).frame).toBe(3);
  });
  it('bounds visual depth and gives generated shapes a safe roster fallback', () => {
    expect(perspectiveScale(-1000)).toBe(0.88);
    expect(perspectiveScale(1000)).toBe(1.04);
    expect(soldierRow('slime')).toBe(5);
    expect(soldierRow('unknown')).toBe(4);
  });
});
