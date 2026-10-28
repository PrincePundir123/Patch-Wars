import { cpus, totalmem } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { createGame, startGame, step, SLIME } from '../packages/game-core/src/index.js';
import {
  FixtureForgeProvider,
  validateBlueprint,
  balance,
  moderate,
} from '../apps/forge-worker/src/pipeline.js';
import { representative, adversarial } from '../packages/test-fixtures/src/prompts.js';
import { Deduplicator } from '../packages/twitch-adapter/src/index.js';
const provider = new FixtureForgeProvider();
const latencies: number[] = [];
const reports = [];
let success = 0;
const causes: Record<string, number> = {};
for (const idea of representative) {
  const start = performance.now();
  try {
    const b = validateBlueprint(await provider.generateUnit(idea, new AbortController().signal));
    const report = await balance(b, 200);
    reports.push({
      name: b.name,
      winRate: report.winRate,
      simulationMs: report.durationMs,
      passed: report.passed,
    });
    if (report.passed) success++;
    else causes.balance = (causes.balance ?? 0) + 1;
  } catch (e) {
    const message = (e as Error).message;
    causes[message] = (causes[message] ?? 0) + 1;
  }
  latencies.push(performance.now() - start);
}
let rejected = 0;
for (const p of adversarial)
  try {
    moderate(p);
  } catch {
    rejected++;
  }
const s = createGame(42, 180);
startGame(s);
s.catalog[SLIME.id] = SLIME;
const start = performance.now();
for (let i = 0; i < 3600; i++) step(s);
const simulationMs = performance.now() - start;
const sorted = [...latencies].sort((a, b) => a - b);
const d = new Deduplicator();
let duplicates = 0;
for (let i = 0; i < 1000; i++) {
  d.accept(String(i));
  if (!d.accept(String(i))) duplicates++;
}
const result = {
  testDate: new Date().toISOString(),
  hardware: {
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryGB: Math.round(totalmem() / 1024 ** 3),
    platform: process.platform,
    node: process.version,
  },
  provider: 'fixture',
  dataset: { representative: 20, adversarial: 30 },
  firstAttemptSuccess: success / 20,
  finalSuccess: success / 20,
  p50Ms: sorted[10],
  p95Ms: sorted[18],
  rejectionCauses: causes,
  adversarialRejected: rejected,
  simulationMs,
  ticksPerSecond: Math.round(3600 / (simulationMs / 1000)),
  duplicateEventsSuppressed: duplicates,
  reports,
};
await mkdir('docs/evaluation', { recursive: true });
await writeFile('docs/evaluation/results.json', JSON.stringify(result, null, 2));
await writeFile(
  'docs/evaluation/results.md',
  `# Local evaluation\n\nRun: \`pnpm evaluate\`\n\nDate (UTC): ${result.testDate}\n\nHardware: ${result.hardware.cpu}; ${result.hardware.cores} logical cores; ${result.hardware.memoryGB} GB RAM; ${process.platform}; Node ${process.version}.\n\n| Metric | Measured value |\n|---|---|\n| Fixture concepts | 20 |\n| Adversarial concepts | 30 |\n| First/final fixture acceptance | ${success}/20 (no fixture retries) |\n| Forge p50 | ${result.p50Ms?.toFixed(1)} ms |\n| Forge p95 | ${result.p95Ms?.toFixed(1)} ms |\n| Adversarial prompts rejected | ${rejected}/30 |\n| Simulation 3600 ticks | ${simulationMs.toFixed(1)} ms |\n| Simulation throughput | ${result.ticksPerSecond} ticks/sec |\n| Duplicate suppression | ${duplicates}/1000 |\n\nEvery accepted blueprint was tested in 200 cost-matched engagements, alternating sides across five starter baselines with seeds 100–299. Accepted interval: 25–75%; this broad initial heuristic is not competitive balance proof. See results.json for each unit.\n\n## Limitations\nThese are stored fixture outputs, not evidence of model quality or live generation latency. Prompt filtering is a conservative local filter, not comprehensive multilingual moderation. Live Twitch latency, live AI billing and public deployment were not measured. Browser timing and accelerated soak results are recorded separately. Hardware scheduling affects wall-clock results.\n`,
);
console.log(JSON.stringify(result, null, 2));
