import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { OllamaForgeProvider } from '../apps/forge-worker/src/ollama.js';
import { validateBlueprint, balance, retryFeedback } from '../apps/forge-worker/src/pipeline.js';
const started = performance.now();
const idea =
  process.argv.slice(2).join(' ') ||
  'A small slime that splits into three weaker children when defeated';
const provider = new OllamaForgeProvider();
const signal = AbortSignal.timeout(Number(process.env.FORGE_TIMEOUT_MS || 180000));
let feedback: string | undefined;
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    const blueprint = validateBlueprint(await provider.generateUnit(idea, signal, feedback));
    console.log(
      JSON.stringify({
        candidate: blueprint.name,
        stats: blueprint.stats,
        abilities: blueprint.abilities,
      }),
    );
    const report = await balance(blueprint);
    if (!report.passed)
      throw new Error(
        `Balance rejected: ${Math.round(report.winRate * 100)}% win rate. Adjust stats and cost to target 25 to 75 percent.`,
      );
    const evidence = {
      date: new Date().toISOString(),
      provider: 'ollama',
      model: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
      attempt,
      generationAndBalanceMs: Math.round(performance.now() - started),
      blueprint,
      report,
    };
    await writeFile('docs/evaluation/local-ai.json', JSON.stringify(evidence, null, 2) + '\n');
    console.log(
      JSON.stringify({
        passed: true,
        model: evidence.model,
        attempt,
        elapsedMs: evidence.generationAndBalanceMs,
        name: blueprint.name,
        winRate: report.winRate,
      }),
    );
    break;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Generation failed';
    console.log(
      JSON.stringify({
        passed: false,
        attempt,
        elapsedMs: Math.round(performance.now() - started),
        error: message,
      }),
    );
    if (attempt === 2 || signal.aborted) {
      process.exitCode = 1;
      break;
    }
    feedback = retryFeedback(e);
  }
}
