import { afterEach, it, expect, vi } from 'vitest';
import { buildApp } from '../apps/server/src/app.js';
import { createProviderProbe } from '../apps/server/src/readiness.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('protects room diagnostics with ownership and keeps checks read-only', async () => {
  const { app, rooms } = await buildApp({ clock: false });
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: 'http://localhost:5173' },
      payload: { mode: 'demo' },
    });
    const id = created.json().id;
    const cookie = created.headers['set-cookie']!.toString().split(';')[0]!;
    const url = `/api/rooms/${id}/readiness?origin=${encodeURIComponent('http://localhost:5173')}`;
    expect((await app.inject(url)).statusCode).toBe(403);
    const before = JSON.stringify(rooms.get(id)!.game);
    const report = await app.inject({ url, headers: { cookie } });
    expect(report.statusCode).toBe(200);
    expect(report.json().checks.find((c: { id: string }) => c.id === 'provider').status).toBe(
      'warn',
    );
    expect(report.json().checks.find((c: { id: string }) => c.id === 'server').status).toBe('pass');
    expect(JSON.stringify(rooms.get(id)!.game)).toBe(before);
    const denied = await app.inject({
      url: `/api/rooms/${id}/readiness?origin=https%3A%2F%2Fevil.test`,
      headers: { cookie },
    });
    expect(denied.json().checks.find((c: { id: string }) => c.id === 'origin').status).toBe('fail');
  } finally {
    await app.close();
  }
});

it('coalesces local model checks without generation or leaking provider secrets', async () => {
  vi.stubEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434');
  vi.stubEnv('OLLAMA_MODEL', 'test-model');
  vi.stubEnv('OPENAI_API_KEY', 'sk-readiness-test-secret');
  const request = vi.fn(
    async (_input: unknown) => new Response(JSON.stringify({ models: [{ name: 'test-model' }] })),
  );
  vi.stubGlobal('fetch', request);
  const probe = createProviderProbe();
  const reports = await Promise.all([probe('ollama'), probe('ollama'), probe('fixture')]);
  expect(reports.map((r) => r.status)).toEqual(['pass', 'pass', 'warn']);
  await probe('ollama');
  expect(request).toHaveBeenCalledTimes(1);
  expect(String(request.mock.calls[0]?.[0])).toBe('http://127.0.0.1:11434/api/tags');
  const cloud = await probe('openai-responses');
  expect(cloud.status).toBe('warn');
  expect(JSON.stringify(cloud)).not.toContain('sk-readiness-test-secret');
  expect(request).toHaveBeenCalledTimes(1);
});

it('reports missing models and rejects non-local diagnostic endpoints', async () => {
  vi.stubEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434');
  const request = vi.fn(async () => new Response(JSON.stringify({ models: [] })));
  vi.stubGlobal('fetch', request);
  expect((await createProviderProbe()('ollama')).status).toBe('fail');
  vi.stubEnv('OLLAMA_BASE_URL', 'https://external.example.test');
  expect((await createProviderProbe()('ollama')).status).toBe('fail');
  expect(request).toHaveBeenCalledTimes(1);
});
