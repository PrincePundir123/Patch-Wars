import { it, expect, vi, afterEach } from 'vitest';
import { buildApp } from '../apps/server/src/app.js';
import { EventSubClient, SCOPES } from '../packages/twitch-adapter/src/index.js';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const canonical = 'https://demo.example.test';
const local = 'http://localhost:5173';
const twitch = {
  clientId: 'test-client',
  clientSecret: 'test-secret',
  redirectUri: canonical + '/auth/twitch/callback',
};
const key = 'local-test-operator-key-long-enough';
it('binds a localhost OAuth flow to its exact callback for both authorization and token exchange', async () => {
  const exchangeUris: string[] = [];
  const request = vi.fn(async (input: unknown, init?: RequestInit) => {
    if (String(input) === 'https://id.twitch.tv/oauth2/token') {
      exchangeUris.push(new URLSearchParams(String(init?.body)).get('redirect_uri')!);
      return new Response(
        JSON.stringify({
          access_token: 'test-access',
          refresh_token: 'test-refresh',
          expires_in: 3600,
        }),
      );
    }
    if (String(input) === 'https://id.twitch.tv/oauth2/validate')
      return new Response(
        JSON.stringify({
          client_id: 'test-client',
          user_id: 'test-channel',
          login: 'testchannel',
          scopes: SCOPES,
          expires_in: 3600,
        }),
      );
    throw new Error('Unexpected network request');
  });
  vi.stubGlobal('fetch', request);
  vi.spyOn(EventSubClient.prototype, 'start').mockImplementation(() => {});
  const { app } = await buildApp({ webOrigin: canonical, adminKey: key, twitch, clock: false });
  try {
    const session = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: local },
      payload: { key },
    });
    const cookie = session.headers['set-cookie']!.toString().split(';')[0]!;
    const created = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: local, cookie },
      payload: { mode: 'live' },
    });
    const id = created.json().id;
    const denied = await app.inject({
      url: `/auth/twitch?room=${id}&origin=${encodeURIComponent('https://evil.test')}`,
      headers: { cookie },
    });
    expect(denied.statusCode).toBe(403);
    const auth = await app.inject({
      url: `/auth/twitch?room=${id}&origin=${encodeURIComponent(local)}`,
      headers: { cookie },
    });
    expect(auth.statusCode).toBe(302);
    const url = new URL(auth.headers.location!);
    expect(url.origin).toBe('https://id.twitch.tv');
    expect(url.searchParams.get('redirect_uri')).toBe(local + '/auth/twitch/callback');
    const state = url.searchParams.get('state');
    const callback = await app.inject({
      url: `/auth/twitch/callback?code=test-code&state=${state}`,
      headers: { cookie },
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe(`/dashboard?room=${id}`);
    expect(exchangeUris).toEqual([local + '/auth/twitch/callback']);
    expect((await app.inject(`/api/rooms/${id}`)).json().channels[0].name).toBe('testchannel');
    expect(
      (
        await app.inject({
          url: `/auth/twitch/callback?code=test-code&state=${state}`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    await app.close();
  }
});
it('keeps the configured callback for canonical and legacy authorization links', async () => {
  const { app } = await buildApp({ webOrigin: canonical, adminKey: key, twitch, clock: false });
  try {
    const session = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: canonical },
      payload: { key },
    });
    const cookie = session.headers['set-cookie']!.toString().split(';')[0]!;
    const created = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: canonical, cookie },
      payload: { mode: 'live' },
    });
    const id = created.json().id;
    for (const suffix of ['', `&origin=${encodeURIComponent(canonical)}`]) {
      const auth = await app.inject({
        url: `/auth/twitch?room=${id}${suffix}`,
        headers: { cookie },
      });
      expect(new URL(auth.headers.location!).searchParams.get('redirect_uri')).toBe(
        twitch.redirectUri,
      );
    }
  } finally {
    await app.close();
  }
});

it('uses the explicitly allowed browser callback even when a legacy configured callback is stale', async () => {
  const { app } = await buildApp({
    webOrigin: canonical,
    adminKey: key,
    twitch: { ...twitch, redirectUri: 'https://old.example.test/auth/twitch/callback' },
    clock: false,
  });
  try {
    const session = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: canonical },
      payload: { key },
    });
    const cookie = session.headers['set-cookie']!.toString().split(';')[0]!;
    const created = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: canonical, cookie },
      payload: { mode: 'live' },
    });
    const auth = await app.inject({
      url: `/auth/twitch?room=${created.json().id}&origin=${encodeURIComponent(canonical)}`,
      headers: { cookie },
    });
    expect(new URL(auth.headers.location!).searchParams.get('redirect_uri')).toBe(
      canonical + '/auth/twitch/callback',
    );
  } finally {
    await app.close();
  }
});
