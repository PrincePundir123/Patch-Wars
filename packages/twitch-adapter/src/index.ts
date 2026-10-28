import { z } from 'zod';
import WebSocket from 'ws';
const id = z.string().min(1).max(100);
export const ChatEventSchema = z.object({
  broadcaster_user_id: id,
  chatter_user_id: id,
  chatter_user_name: z.string().max(100),
  message_id: id,
  message: z.object({ text: z.string().max(500) }),
  source_broadcaster_user_id: id.nullish(),
  source_message_id: id.nullish(),
});
export type ChatMessage = {
  id: string;
  channelId: string;
  userId: string;
  name: string;
  text: string;
};
export function normalizeChat(input: unknown): ChatMessage {
  const e = ChatEventSchema.parse(input);
  const channelId = e.source_broadcaster_user_id ?? e.broadcaster_user_id;
  return {
    id: `${channelId}:${e.source_message_id ?? e.message_id}`,
    channelId,
    userId: e.chatter_user_id,
    name: e.chatter_user_name,
    text: e.message.text,
  };
}
export class Deduplicator {
  private seen = new Map<string, number>();
  constructor(
    private ttl = 600000,
    private capacity = 20000,
  ) {}
  accept(id: string, now = Date.now()) {
    for (const [key, at] of this.seen) {
      if (now - at <= this.ttl) break;
      this.seen.delete(key);
    }
    if (this.seen.has(id)) return false;
    if (this.seen.size >= this.capacity) this.seen.delete(this.seen.keys().next().value!);
    this.seen.set(id, now);
    return true;
  }
}
export function parseCommand(text: string) {
  if (text.length > 220) return null;
  const m = /^!(join|spawn|attack|defend|forge|vote|units|score|help)(?:\s+(.+))?\s*$/i.exec(
    text.trim(),
  );
  if (!m) return null;
  const command = m[1]!.toLowerCase();
  const argument = (m[2] ?? '').trim();
  if (['join', 'attack', 'defend', 'units', 'score', 'help'].includes(command) && argument)
    return null;
  if (command === 'forge' && (argument.length < 5 || argument.length > 180)) return null;
  if (command === 'vote' && !/^p[1-9][0-9]{0,3}$/.test(argument)) return null;
  if (command === 'spawn' && argument && !/^[a-z][a-z0-9-]{0,39}$/.test(argument)) return null;
  return { command, argument };
}
export class RateGate {
  private windows = new Map<string, { at: number; count: number }>();
  allow(key: string, limit: number, windowMs: number, now = Date.now()) {
    let v = this.windows.get(key);
    if (!v || now - v.at >= windowMs) {
      v = { at: now, count: 0 };
      this.windows.set(key, v);
    }
    if (this.windows.size > 30000) {
      for (const [k, w] of this.windows) if (now - w.at > 60000) this.windows.delete(k);
      if (this.windows.size > 30000) return false;
    }
    return ++v.count <= limit;
  }
}
export const SCOPES = ['user:read:chat', 'user:write:chat'];
const TokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.array(z.string()).optional(),
});
const ValidationSchema = z.object({
  client_id: z.string(),
  user_id: z.string(),
  login: z.string(),
  scopes: z.array(z.string()),
  expires_in: z.number(),
});
export type TwitchConfig = { clientId: string; clientSecret: string; redirectUri: string };
export class TwitchIdentity {
  private token = '';
  private refresh = '';
  private expires = 0;
  private refreshing: Promise<void> | null = null;
  userId = '';
  login = '';
  constructor(
    private config: TwitchConfig,
    private request: typeof fetch = fetch,
  ) {}
  async exchange(code: string) {
    const response = await this.request('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Twitch authorization failed. Reconnect your account.');
    this.setToken(await response.json());
    await this.validate();
  }
  private setToken(raw: unknown) {
    const t = TokenSchema.parse(raw);
    this.token = t.access_token;
    this.refresh = t.refresh_token;
    this.expires = Date.now() + t.expires_in * 1000;
  }
  private async renew() {
    if (!this.refreshing)
      this.refreshing = (async () => {
        const r = await this.request('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          body: new URLSearchParams({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: this.refresh,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) {
          this.token = '';
          throw new Error('Twitch token revoked. Reconnect your account.');
        }
        this.setToken(await r.json());
      })().finally(() => {
        this.refreshing = null;
      });
    await this.refreshing;
  }
  async validate() {
    if (this.expires < Date.now() + 60000 && this.refresh) await this.renew();
    const r = await this.request('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${this.token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('Twitch token validation failed. Reconnect.');
    const v = ValidationSchema.parse(await r.json());
    if (
      v.client_id !== this.config.clientId ||
      SCOPES.some((s) => !v.scopes.includes(s)) ||
      (this.userId && this.userId !== v.user_id)
    )
      throw new Error('Twitch identity or required scopes do not match.');
    this.userId = v.user_id;
    this.login = v.login;
    this.expires = Date.now() + v.expires_in * 1000;
  }
  async api(path: string, body?: unknown, retry = true): Promise<unknown> {
    if (this.expires < Date.now() + 60000) await this.renew();
    const r = await this.request(`https://api.twitch.tv/helix/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Client-Id': this.config.clientId,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 401 && retry) {
      await this.renew();
      return this.api(path, body, false);
    }
    if (!r.ok) throw new Error(`Twitch API rejected the request (${r.status}).`);
    return r.json();
  }
  async revoke() {
    if (this.token)
      await this.request('https://id.twitch.tv/oauth2/revoke', {
        method: 'POST',
        body: new URLSearchParams({ client_id: this.config.clientId, token: this.token }),
        signal: AbortSignal.timeout(10000),
      });
    this.token = '';
    this.refresh = '';
  }
  private sendGate = new RateGate();
  async say(channel: string, message: string) {
    if (!this.sendGate.allow('all', 15, 30000) || !this.sendGate.allow(channel, 1, 2000)) return;
    return this.api('chat/messages', {
      broadcaster_id: channel,
      sender_id: this.userId,
      message: message.slice(0, 450),
    });
  }
}
const Envelope = z.object({
  metadata: z.object({
    message_id: id,
    message_type: z.enum([
      'session_welcome',
      'session_keepalive',
      'session_reconnect',
      'notification',
      'revocation',
    ]),
    message_timestamp: z.string(),
  }),
  payload: z.object({
    session: z
      .object({
        id: id,
        keepalive_timeout_seconds: z.number().nullable().optional(),
        reconnect_url: z.string().nullable().optional(),
      })
      .optional(),
    subscription: z.object({ type: z.string(), status: z.string().optional() }).optional(),
    event: z.unknown().optional(),
  }),
});
export function safeReconnect(url: string) {
  const u = new URL(url);
  return (
    u.protocol === 'wss:' && u.hostname === 'eventsub.wss.twitch.tv' && !u.username && !u.password
  );
}
export class EventSubClient {
  private socket: WebSocket | null = null;
  private sockets = new Set<WebSocket>();
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private validateTimer: ReturnType<typeof setInterval> | undefined;
  private lastMessage = Date.now();
  private timeout = 30000;
  private dedupe = new Deduplicator();
  private backoff = 1000;
  constructor(
    private identity: TwitchIdentity,
    private onEvent: (type: string, event: unknown, id: string, timestamp: number) => void,
    private status: (s: string) => void,
  ) {}
  start() {
    this.stopped = false;
    this.connect('wss://eventsub.wss.twitch.tv/ws', false);
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastMessage > this.timeout + 5000) this.socket?.terminate();
    }, 5000);
    this.validateTimer = setInterval(() => {
      void this.identity.validate().catch(() => {
        this.status('authorization expired');
        this.stop();
      });
    }, 55 * 60000);
  }
  private connect(url: string, migrate: boolean) {
    if (this.stopped) return;
    const old = this.socket;
    const ws = new WebSocket(url, { maxPayload: 65536, handshakeTimeout: 10000 });
    this.sockets.add(ws);
    if (!migrate) {
      this.socket = ws;
      this.lastMessage = Date.now();
    }
    let welcomed = false;
    ws.on('message', (data) => {
      void (async () => {
        const parsed = Envelope.safeParse(JSON.parse(data.toString()));
        if (!parsed.success) return;
        const m = parsed.data;
        this.lastMessage = Date.now();
        if (m.metadata.message_type === 'session_welcome') {
          const session = m.payload.session;
          if (!session) throw new Error('Missing session');
          this.socket = ws;
          welcomed = true;
          this.timeout = (session.keepalive_timeout_seconds ?? 30) * 1000;
          this.backoff = 1000;
          if (migrate) old?.close();
          else await this.subscribe(session.id);
          this.status('connected');
        } else if (m.metadata.message_type === 'session_reconnect') {
          const next = m.payload.session?.reconnect_url;
          if (next && safeReconnect(next)) this.connect(next, true);
          else ws.terminate();
        } else if (m.metadata.message_type === 'revocation') {
          this.status('authorization revoked');
          this.stop();
        } else if (m.metadata.message_type === 'notification') {
          const timestamp = Date.parse(m.metadata.message_timestamp);
          if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 600000) return;
          if (this.dedupe.accept(m.metadata.message_id))
            this.onEvent(
              m.payload.subscription?.type ?? '',
              m.payload.event,
              m.metadata.message_id,
              timestamp,
            );
        }
      })().catch(() => {
        this.status('connection error');
        ws.terminate();
      });
    });
    ws.on('error', () => {
      this.status('reconnecting');
    });
    ws.on('close', () => {
      this.sockets.delete(ws);
      if (this.stopped) return;
      if (this.socket === ws || (!welcomed && !this.socket)) {
        this.socket = null;
        this.status('reconnecting');
        clearTimeout(this.retry);
        this.retry = setTimeout(
          () => this.connect('wss://eventsub.wss.twitch.tv/ws', false),
          this.backoff,
        );
        this.backoff = Math.min(this.backoff * 2, 30000);
      } else if (migrate && !welcomed) old?.terminate();
    });
  }
  private async subscribe(sessionId: string) {
    const transport = { method: 'websocket', session_id: sessionId };
    const user = this.identity.userId;
    await this.identity.api('eventsub/subscriptions', {
      type: 'channel.chat.message',
      version: '1',
      condition: { broadcaster_user_id: user, user_id: user },
      transport,
    });
    for (const type of [
      'channel.raid',
      'channel.shared_chat.begin',
      'channel.shared_chat.update',
      'channel.shared_chat.end',
    ]) {
      try {
        await this.identity.api('eventsub/subscriptions', {
          type,
          version: '1',
          condition:
            type === 'channel.raid'
              ? { to_broadcaster_user_id: user }
              : { broadcaster_user_id: user },
          transport,
        });
      } catch {
        this.status(`connected; ${type} unavailable`);
      }
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearInterval(this.watchdog);
    clearInterval(this.validateTimer);
    for (const ws of this.sockets) ws.close();
    this.sockets.clear();
    this.socket = null;
  }
}
