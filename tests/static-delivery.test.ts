import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../apps/server/src/app.js';

it('keeps public assets available after API exhaustion without weakening API/auth limits', async () => {
  const webRoot = await mkdtemp(join(tmpdir(), 'patch-static-'));
  await mkdir(join(webRoot, 'assets'));
  await mkdir(join(webRoot, 'art'));
  await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>Test app</title>');
  await writeFile(join(webRoot, 'assets', 'index-AbCd1234.js'), 'export const ready=true;');
  await writeFile(join(webRoot, 'art', 'arena.webp'), 'test image');
  const { app } = await buildApp({ clock: false, webRoot });
  try {
    for (let i = 0; i < 130; i++)
      expect((await app.inject('/assets/index-AbCd1234.js')).statusCode).toBe(200);
    for (let i = 0; i < 120; i++) expect((await app.inject('/api/me')).statusCode).toBe(200);
    expect((await app.inject('/api/me?asset=/assets/index-AbCd1234.js')).statusCode).toBe(429);
    expect((await app.inject('/auth/twitch')).statusCode).toBe(429);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/session',
          headers: { origin: 'http://localhost:5173' },
          payload: { key: 'invalid' },
        })
      ).statusCode,
    ).toBe(429);
    const asset = await app.inject('/assets/index-AbCd1234.js');
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await app.inject('/art/arena.webp')).headers['cache-control']).not.toContain(
      'immutable',
    );
    expect((await app.inject('/dashboard?room=test')).headers['cache-control']).toBe('no-cache');
    const missing = await app.inject('/assets/missing.js');
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['content-type']).toContain('application/json');
    expect((await app.inject('/auth/unknown')).statusCode).toBe(404);
  } finally {
    await app.close();
    await rm(webRoot, { recursive: true, force: true });
  }
});
