import { parentPort, workerData } from 'node:worker_threads';
import {
  FixtureForgeProvider,
  OpenAIForgeProvider,
  validateBlueprint,
  balance,
  moderate,
} from './pipeline.js';
import { CodexForgeProvider } from './codex.js';
const { idea, provider, timeout } = workerData as {
  idea: string;
  provider: string;
  timeout: number;
};
const send = (status: string, extra: object = {}) => parentPort?.postMessage({ status, ...extra });
try {
  moderate(idea);
  const generator =
    provider === 'codex-sdk'
      ? new CodexForgeProvider()
      : provider === 'openai-responses'
        ? new OpenAIForgeProvider()
        : new FixtureForgeProvider();
  const signal = AbortSignal.timeout(timeout);
  let accepted = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      send('generating', { attempt });
      const raw = await generator.generateUnit(idea, signal);
      send('validating', { attempt });
      const blueprint = validateBlueprint(raw);
      send('simulating', { attempt });
      const report = await balance(blueprint);
      if (!report.passed)
        throw new Error(`Balance rejected: ${Math.round(report.winRate * 100)}% win rate.`);
      send('approved', { blueprint, report, attempt });
      accepted = true;
      break;
    } catch (error) {
      if (attempt === 2 || signal.aborted || provider === 'fixture') throw error;
    }
  }
  if (!accepted) throw new Error('Generation failed.');
} catch (error) {
  send('rejected', { error: error instanceof Error ? error.message : 'Forge failed.' });
}
