import { ollamaEndpoint } from '../../forge-worker/src/ollama.js';

import type { ReadinessCheck } from '../../../packages/shared/src/index.js';
const configured = (value: string | undefined) =>
  !!value && !/^(your_|paste_|replace_|example)/i.test(value);

// Read-only, bounded and coalesced: checking readiness never starts generation.
export function createProviderProbe() {
  const cached = new Map<string, { until: number; result: ReadinessCheck }>();
  const running = new Map<string, Promise<ReadinessCheck>>();
  return async (provider: string): Promise<ReadinessCheck> => {
    const previous = cached.get(provider);
    if (previous && Date.now() < previous.until) return previous.result;
    const inFlight = running.get(provider);
    if (inFlight) return inFlight;
    const pending = (async (): Promise<ReadinessCheck> => {
      const base = { id: 'provider', label: 'Forge provider' };
      if (provider === 'fixture')
        return {
          ...base,
          status: 'warn',
          detail:
            'Predefined fixture output. Suitable for rehearsal; this is not live AI generation.',
        };
      if (provider === 'ollama') {
        try {
          const endpoint = new URL('/api/tags', ollamaEndpoint());
          const response = await fetch(endpoint, {
            signal: AbortSignal.timeout(1500),
            redirect: 'error',
          });
          if (!response.ok) throw new Error();
          const data = (await response.json()) as { models?: { name?: string; model?: string }[] };
          const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
          return data.models?.some((m) => m.name === model || m.model === model)
            ? {
                ...base,
                status: 'pass',
                detail:
                  'Local Ollama is reachable and the configured model is installed. Generation quality is not tested.',
              }
            : {
                ...base,
                status: 'fail',
                detail:
                  'The configured local model is missing. Install it in Ollama, then check again.',
              };
        } catch {
          return {
            ...base,
            status: 'fail',
            detail:
              'Cannot reach the configured local Ollama server. Start Ollama and check its local address.',
          };
        }
      }
      if (provider === 'openai-responses')
        return {
          ...base,
          status: configured(process.env.OPENAI_API_KEY) ? 'warn' : 'fail',
          detail: configured(process.env.OPENAI_API_KEY)
            ? 'API key is configured. No billed request was made; live generation is unverified.'
            : 'Configure OPENAI_API_KEY locally before selecting this provider.',
        };
      return {
        ...base,
        status: process.env.CODEX_ISOLATED === 'true' ? 'warn' : 'fail',
        detail:
          'Codex generation requires separately verified OS isolation and runtime access. No generation was started.',
      };
    })();
    running.set(provider, pending);
    try {
      const result = await pending;
      cached.set(provider, { until: Date.now() + 5000, result });
      return result;
    } finally {
      running.delete(provider);
    }
  };
}
