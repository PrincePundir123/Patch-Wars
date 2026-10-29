import { SLIME } from '../../../packages/game-core/src/index.js';
import { moderate, SYSTEM_PROMPT, type ForgeProvider } from './pipeline.js';
import { z } from 'zod';
import { BlueprintSchema } from '../../../packages/shared/src/index.js';

export function localBlueprintSchema() {
  const schema = z.toJSONSchema(BlueprintSchema);
  // Keep JS Unicode regex validation in Zod; local grammar regex dialects differ.
  const clean = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const item = node as Record<string, unknown>;
    if (typeof item.pattern === 'string' && item.pattern.includes('\\p')) delete item.pattern;
    Object.values(item).forEach(clean);
  };
  clean(schema);
  return schema;
}

export function ollamaEndpoint() {
  const url = new URL(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434');
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('Ollama must use a local HTTP origin, such as http://127.0.0.1:11434.');
  }
  return new URL('/api/chat', url);
}

export class OllamaForgeProvider implements ForgeProvider {
  readonly name = 'ollama';
  async generateUnit(idea: string, signal: AbortSignal, feedback?: string): Promise<unknown> {
    moderate(idea);
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,100}$/.test(model) || /cloud/i.test(model))
      throw new Error('Choose an installed local Ollama model, not a cloud model.');
    const endpoint = ollamaEndpoint();
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          keep_alive: '5m',
          format: localBlueprintSchema(),
          options: { temperature: 0.2, num_predict: 1600, num_ctx: 4096 },
          messages: [
            {
              role: 'system',
              content:
                SYSTEM_PROMPT +
                ' Stats must be bounded: health 20..200, damage 2..25, range 18..160, cooldown 10..60, speed 0.5..3, cost 2..10. Use integer health, damage, cooldown and cost. Use only the one ability requested, not every available ability. Split: count 1..3, scale 0.15..0.4. Shield: amount 1..50. Slow: duration 1..60 ticks. Heal: amount 1..12, radius 20..140, every 20..100 ticks. Splash: amount 1..12, radius 10..90, every 2..8 attacks. This balanced example is a reference, adapt it to the idea: ' +
                JSON.stringify(SLIME),
            },
            {
              role: 'user',
              content: JSON.stringify({
                viewerIdea: idea,
                ...(feedback ? { previousCheck: feedback } : {}),
              }),
            },
          ],
        }),
      });
    } catch {
      if (signal.aborted)
        throw new Error('Local AI timed out. Try a smaller model or increase FORGE_TIMEOUT_MS.');
      throw new Error('Cannot reach local Ollama. Start Ollama and check OLLAMA_BASE_URL.');
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        response.status === 404
          ? 'Local model not found. Run ollama list and set OLLAMA_MODEL to an installed model.'
          : `Local AI request failed (${response.status}).`,
      );
    }
    // Bound the HTTP envelope before parsing, not just the generated content.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Local AI returned an empty response.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 64000) throw new Error('Local AI response exceeds the size budget.');
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    let data: { done?: boolean; done_reason?: string; message?: { content?: unknown } };
    try {
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new Error('Local AI returned invalid JSON.');
    }
    const output = data?.message?.content;
    if (
      !data?.done ||
      data.done_reason === 'length' ||
      typeof output !== 'string' ||
      !output ||
      output.length > 10000
    )
      throw new Error('Local AI returned incomplete or oversized output.');
    try {
      return JSON.parse(output);
    } catch {
      throw new Error('Local AI blueprint is not valid JSON.');
    }
  }
}
