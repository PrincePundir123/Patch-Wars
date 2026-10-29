import 'dotenv/config';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { originPolicy } from '../apps/server/src/origins.js';
import { ollamaEndpoint } from '../apps/forge-worker/src/ollama.js';
type Check = { name: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string };
const checks: Check[] = [];
const add = (name: string, status: Check['status'], detail: string) =>
  checks.push({ name, status, detail });
const production = process.env.NODE_ENV === 'production';
add(
  'Node runtime',
  Number(process.versions.node.split('.')[0]) >= 22 ? 'PASS' : 'FAIL',
  'Node 22 or newer is required.',
);
try {
  originPolicy(process.env.WEB_ORIGIN || 'http://localhost:5173', production);
  add(
    'Browser origins',
    'PASS',
    production
      ? 'Only the configured production origin is allowed.'
      : 'The configured origin and exact localhost:5173 / 127.0.0.1:5173 aliases are allowed.',
  );
} catch {
  add(
    'Browser origins',
    'FAIL',
    'Set WEB_ORIGIN to an HTTP(S) origin without credentials, query or path.',
  );
}
const configured = (value: string | undefined) =>
  !!value && !/^(your_|paste_|replace_|example)/i.test(value);
add(
  'Operator key',
  configured(process.env.ADMIN_KEY) &&
    (process.env.ADMIN_KEY?.length || 0) >= (production ? 32 : 24)
    ? 'PASS'
    : 'FAIL',
  'The local operator key must be configured and sufficiently long. Its value is never printed.',
);
add(
  'Twitch credentials',
  configured(process.env.TWITCH_CLIENT_ID) && configured(process.env.TWITCH_CLIENT_SECRET)
    ? 'PASS'
    : 'WARN',
  'Configured credentials still require real channel consent; presence is not live acceptance.',
);
try {
  const callback = new URL(
    process.env.TWITCH_REDIRECT_URI ||
      `${process.env.WEB_ORIGIN || 'http://localhost:5173'}/auth/twitch/callback`,
  );
  if (
    !['http:', 'https:'].includes(callback.protocol) ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash ||
    callback.pathname !== '/auth/twitch/callback'
  )
    throw new Error();
  add(
    'Twitch callback',
    'PASS',
    'Register the exact callback shown in the control room for each browser address you use.',
  );
} catch {
  add(
    'Twitch callback',
    'FAIL',
    'TWITCH_REDIRECT_URI must point to /auth/twitch/callback without credentials or query parameters.',
  );
}
let tracking: 'tracked' | 'untracked' | 'unknown' = 'unknown';
try {
  execFileSync('git', ['ls-files', '--error-unmatch', '.env'], { stdio: 'pipe' });
  tracking = 'tracked';
} catch (error) {
  if ((error as { status?: number }).status === 1) tracking = 'untracked';
}
add(
  'Local secrets',
  tracking === 'tracked' ? 'FAIL' : tracking === 'untracked' ? 'PASS' : 'WARN',
  tracking === 'tracked'
    ? 'Remove .env from Git tracking before publishing.'
    : tracking === 'untracked'
      ? 'The local .env is not tracked by Git.'
      : 'Git tracking could not be checked; verify .env is excluded before publishing.',
);
add(
  'Forge worker',
  existsSync('dist/forge/worker.js') ? 'PASS' : 'WARN',
  'pnpm dev, pnpm test and pnpm build generate the worker bundle.',
);
const provider = process.env.FORGE_PROVIDER || 'fixture';
if (provider === 'ollama') {
  try {
    const endpoint = ollamaEndpoint();
    const response = await fetch(new URL('/api/tags', endpoint), {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as { models?: { name: string; model?: string }[] };
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
    add(
      'Local AI model',
      data.models?.some((m) => m.name === model || m.model === model) ? 'PASS' : 'FAIL',
      'The configured model must be installed in local Ollama. No generation request was made.',
    );
  } catch {
    add(
      'Local AI model',
      'FAIL',
      'Start local Ollama, check OLLAMA_BASE_URL, and run ollama list.',
    );
  }
} else if (provider === 'fixture')
  add(
    'AI provider',
    'WARN',
    'Fixture mode is reproducible but must not be presented as real AI generation.',
  );
else if (provider === 'openai-responses')
  add(
    'AI provider',
    configured(process.env.OPENAI_API_KEY) ? 'PASS' : 'FAIL',
    'API key presence only; no billed request was made.',
  );
else if (provider === 'codex-sdk')
  add('AI provider', 'WARN', 'Codex runtime requires separately verified OS isolation.');
else add('AI provider', 'FAIL', 'Choose fixture, ollama, openai-responses or codex-sdk.');
try {
  const response = await fetch(
    `http://${process.env.HOST === '0.0.0.0' ? '127.0.0.1' : process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}/health`,
    { signal: AbortSignal.timeout(3000) },
  );
  if (!response.ok) throw new Error();
  const data = (await response.json()) as { status?: string };
  add(
    'Running server',
    data.status === 'ok' ? 'PASS' : 'WARN',
    'Local health endpoint responded. This does not establish public tunnel access.',
  );
} catch {
  add('Running server', 'WARN', 'Start the project with pnpm dev before a live rehearsal.');
}
for (const c of checks) console.log(`${c.status.padEnd(4)}  ${c.name}: ${c.detail}`);
console.log(
  '\nLocal preflight only. Real Twitch-to-AI footage, second-channel testing, hosting and Devpost submission remain in docs/readiness.md.',
);
if (checks.some((c) => c.status === 'FAIL')) process.exitCode = 1;
