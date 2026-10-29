import { describe, it, expect } from 'vitest';
import { originPolicy } from '../apps/server/src/origins.js';
import { buildApp } from '../apps/server/src/app.js';
const tunnel = 'https://demo.example.test';
const key = 'local-test-operator-key-long-enough';
describe('explicit development origins', () => {
  it('accepts only canonical origin and exact development aliases', () => {
    const p = originPolicy(tunnel + '/', false);
    expect(p.canonical).toBe(tunnel);
    for (const o of [tunnel, 'http://localhost:5173', 'http://127.0.0.1:5173'])
      expect(p.allows(o)).toBe(true);
    for (const o of [
      undefined,
      'null',
      'https://evil.test',
      'http://localhost:5173.evil.test',
      'http://localhost:5174',
      'http://localhost:5173/',
    ])
      expect(p.allows(o)).toBe(false);
  });
  it('keeps production restricted to the configured origin', () => {
    const p = originPolicy(tunnel, true);
    expect(p.allows(tunnel)).toBe(true);
    expect(p.allows('http://localhost:5173')).toBe(false);
    expect(p.allows('http://127.0.0.1:5173')).toBe(false);
  });
  it.each([
    'not-a-url',
    'file:///tmp',
    'https://demo.test/path',
    'https://user:pass@demo.test',
    'https://demo.test?x=1',
  ])('rejects ambiguous configuration %s', (s) =>
    expect(() => originPolicy(s, false)).toThrow('WEB_ORIGIN'),
  );
  it('unlocks and controls owned rooms on localhost while configured for a tunnel', async () => {
    const { app } = await buildApp({ webOrigin: tunnel, adminKey: key, clock: false });
    try {
      for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', tunnel]) {
        const unlocked = await app.inject({
          method: 'POST',
          url: '/api/session',
          headers: { origin },
          payload: { key },
        });
        expect(unlocked.statusCode).toBe(200);
        const cookie = unlocked.headers['set-cookie']!.toString().split(';')[0]!;
        const created = await app.inject({
          method: 'POST',
          url: '/api/rooms',
          headers: { origin, cookie },
          payload: { mode: 'demo' },
        });
        expect(created.statusCode).toBe(200);
        const id = created.json().id;
        expect(
          (
            await app.inject({
              method: 'POST',
              url: `/api/rooms/${id}/control`,
              headers: { origin, cookie },
              payload: { action: 'start' },
            })
          ).statusCode,
        ).toBe(200);
      }
      for (const origin of ['https://evil.test', 'null', undefined]) {
        const rejected = await app.inject({
          method: 'POST',
          url: '/api/session',
          headers: origin ? { origin } : {},
          payload: { key },
        });
        expect(rejected.statusCode).toBe(403);
      }
    } finally {
      await app.close();
    }
  });
  it('does not permit development aliases in production even with a valid key', async () => {
    const { app } = await buildApp({
      webOrigin: tunnel,
      adminKey: key,
      clock: false,
      production: true,
    });
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/session',
            headers: { origin: 'http://localhost:5173' },
            payload: { key },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  });
});
