import { it, expect } from 'vitest';
import { COMMAND_REFERENCE } from '../packages/shared/src/command-reference.js';
import { parseCommand } from '../packages/twitch-adapter/src/index.js';
import { Room } from '../apps/server/src/room.js';

it('documents examples accepted by the real chat parser', () => {
  for (const entry of COMMAND_REFERENCE)
    expect(parseCommand(entry.example)?.command).toBe(entry.command);
  expect(new Set(COMMAND_REFERENCE.map((c) => c.command)).size).toBe(9);
});
it('keeps the guide accurate about attack and defend deploying units', () => {
  const room = new Room('test', 'demo');
  try {
    room.start();
    room.demoCommand('!attack', 'ember', 'attacker');
    expect(room.game.units.at(-1)?.blueprintId).toBe('sprinter');
    room.demoCommand('!defend', 'ember', 'defender');
    expect(room.game.units.at(-1)?.blueprintId).toBe('guardian');
  } finally {
    room.dispose();
  }
});
