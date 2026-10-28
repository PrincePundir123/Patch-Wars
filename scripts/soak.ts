import {
  createGame,
  startGame,
  step,
  spawn,
  SLIME,
  MAX_ENTITIES,
} from '../packages/game-core/src/index.js';
import { writeFile, mkdir } from 'node:fs/promises';
const start = performance.now();
const initial = process.memoryUsage().heapUsed;
let ticks = 0;
let peak = 0;
let splits = 0;
const rounds = Number(process.env.SOAK_ROUNDS ?? 120);
for (let r = 0; r < rounds; r++) {
  const s = createGame(r + 1, 120);
  s.catalog[SLIME.id] = SLIME;
  startGame(s);
  for (let i = 0; i < 2400; i++) {
    if (i % 200 === 0) {
      spawn(s, 'ember', SLIME.id, true);
      spawn(s, 'azure', SLIME.id, true);
    }
    step(s);
    ticks++;
    peak = Math.max(peak, s.units.length);
    if (s.units.length > MAX_ENTITIES || s.units.some((u) => !Number.isFinite(u.hp + u.x + u.y)))
      throw new Error('Simulation invariant failed.');
  }
  splits += s.nextEvent;
}
const result = {
  date: new Date().toISOString(),
  rounds,
  ticks,
  simulatedHours: ticks / 20 / 3600,
  wallSeconds: (performance.now() - start) / 1000,
  peakEntities: peak,
  events: splits,
  heapDeltaBytes: process.memoryUsage().heapUsed - initial,
  failures: 0,
  note: 'Accelerated simulation soak; not a multi-hour wall-clock network or browser soak.',
};
await mkdir('docs/evaluation', { recursive: true });
await writeFile('docs/evaluation/soak.json', JSON.stringify(result, null, 2));
console.log(result);
