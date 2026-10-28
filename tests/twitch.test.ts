import { describe, it, expect } from 'vitest';
import {
  normalizeChat,
  Deduplicator,
  parseCommand,
  RateGate,
  safeReconnect,
  TwitchIdentity,
} from '../packages/twitch-adapter/src/index.js';
describe('Twitch boundaries', () => {
  it('attributes replicated messages to original channel and deduplicates', () => {
    const e = {
      broadcaster_user_id: 'a',
      chatter_user_id: 'u',
      chatter_user_name: 'Viewer',
      message_id: 'copy',
      message: { text: '!vote p1' },
      source_broadcaster_user_id: 'b',
      source_message_id: 'original',
    };
    const a = normalizeChat(e);
    const b = normalizeChat({
      ...e,
      broadcaster_user_id: 'b',
      message_id: 'original',
      source_broadcaster_user_id: null,
      source_message_id: null,
    });
    expect(a).toEqual(b);
    const d = new Deduplicator();
    expect(d.accept(a.id)).toBe(true);
    expect(d.accept(b.id)).toBe(false);
  });
  it('expires dedupe entries and bounds storage', () => {
    const d = new Deduplicator(10, 2);
    expect(d.accept('a', 0)).toBe(true);
    expect(d.accept('a', 1)).toBe(false);
    expect(d.accept('a', 11)).toBe(true);
  });
  it('validates commands and refuses injected arguments', () => {
    expect(parseCommand('!forge a tiny dragon')?.command).toBe('forge');
    for (const bad of [
      '!vote ../../x',
      '!spawn <script>',
      '!help junk',
      '!forge x',
      '!attack ' + 'a'.repeat(300),
    ])
      expect(parseCommand(bad)).toBeNull();
  });
  it('rate limits a burst then recovers', () => {
    const r = new RateGate();
    expect(r.allow('u', 1, 100, 0)).toBe(true);
    expect(r.allow('u', 1, 100, 1)).toBe(false);
    expect(r.allow('u', 1, 100, 101)).toBe(true);
  });
  it('only accepts Twitch reconnect endpoints', () => {
    expect(safeReconnect('wss://eventsub.wss.twitch.tv/ws?token=x')).toBe(true);
    expect(safeReconnect('wss://evil.example/ws')).toBe(false);
    expect(safeReconnect('ws://eventsub.wss.twitch.tv/ws')).toBe(false);
  });
  it('rejects missing scopes', async () => {
    const request = async (url: string | URL | Request) =>
      new Response(
        JSON.stringify(
          String(url).endsWith('/token')
            ? { access_token: 'test', refresh_token: 'test', expires_in: 3600 }
            : { client_id: 'id', user_id: 'u', login: 'viewer', scopes: [], expires_in: 3600 },
        ),
      );
    const i = new TwitchIdentity(
      { clientId: 'id', clientSecret: 'unused', redirectUri: 'http://localhost' },
      request,
    );
    await expect(i.exchange('code')).rejects.toThrow('scopes');
  });
  it('rejects malformed chat payloads', () =>
    expect(() => normalizeChat({ message: 'bad' })).toThrow());
});
