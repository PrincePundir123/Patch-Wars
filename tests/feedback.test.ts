import { it, expect } from 'vitest';
import { Room } from '../apps/server/src/room.js';
it('reports accepted commands with an entity ID and omits viewer identity', () => {
  const r = new Room('owner', 'demo');
  r.start();
  r.demoCommand('!spawn archer', 'ember', 'private-viewer');
  const receipt = r.snapshot().commandFeedback[0]!;
  expect(receipt.message).toBe('Archer deployed.');
  expect(r.game.units.find((u) => u.id === receipt.entityId)?.blueprintId).toBe('archer');
  expect(JSON.stringify(receipt)).not.toContain('private-viewer');
  r.dispose();
});
it('explains paused and completed matches and bounds feedback history', () => {
  const r = new Room('owner', 'demo');
  r.start();
  r.paused = true;
  expect(r.demoCommand('!spawn archer', 'ember')).toContain('paused');
  r.paused = false;
  r.game.phase = 'results';
  expect(r.demoCommand('!spawn archer', 'ember')).toContain('Battle ended');
  for (let i = 0; i < 20; i++) r.demoCommand('!score', 'ember');
  expect(r.commandFeedback).toHaveLength(8);
  r.reset();
  expect(r.commandFeedback).toHaveLength(0);
  r.dispose();
});
