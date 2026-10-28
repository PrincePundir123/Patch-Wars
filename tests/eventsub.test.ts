import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, afterEach } from 'vitest';
const state = vi.hoisted(() => ({
  sockets: [] as {
    emit: (event: string, ...args: unknown[]) => boolean;
    url: string;
    close: () => void;
    terminate: () => void;
  }[],
}));
vi.mock('ws', () => ({
  default: class extends EventEmitter {
    url: string;
    constructor(url: string) {
      super();
      this.url = url;
      state.sockets.push(this);
    }
    close() {
      this.emit('close');
    }
    terminate() {
      this.emit('close');
    }
  },
}));
import { EventSubClient, type TwitchIdentity } from '../packages/twitch-adapter/src/index.js';
afterEach(() => {
  vi.useRealTimers();
  state.sockets.length = 0;
});
const envelope = (type: string, payload: unknown, id = 'message') =>
  JSON.stringify({
    metadata: { message_id: id, message_type: type, message_timestamp: new Date().toISOString() },
    payload,
  });
describe('EventSub lifecycle', () => {
  it('subscribes on welcome, deduplicates notifications, migrates without resubscribing', async () => {
    const identity = {
      userId: '1',
      api: vi.fn().mockResolvedValue({}),
      validate: vi.fn().mockResolvedValue({}),
    };
    const event = vi.fn(),
      status = vi.fn();
    const c = new EventSubClient(identity as unknown as TwitchIdentity, event, status);
    c.start();
    const first = state.sockets[0]!;
    first.emit(
      'message',
      Buffer.from(
        envelope('session_welcome', { session: { id: 'session', keepalive_timeout_seconds: 30 } }),
      ),
    );
    await vi.waitFor(() => expect(identity.api).toHaveBeenCalledTimes(5));
    const n = envelope('notification', {
      subscription: { type: 'channel.chat.message' },
      event: { message: 'test' },
    });
    first.emit('message', Buffer.from(n));
    first.emit('message', Buffer.from(n));
    expect(event).toHaveBeenCalledTimes(1);
    first.emit(
      'message',
      Buffer.from(
        envelope('session_reconnect', {
          session: { id: 'session', reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=x' },
        }),
      ),
    );
    expect(state.sockets).toHaveLength(2);
    state.sockets[1]!.emit(
      'message',
      Buffer.from(envelope('session_welcome', { session: { id: 'new' } })),
    );
    await Promise.resolve();
    expect(identity.api).toHaveBeenCalledTimes(5);
    c.stop();
  });
  it('recovers subscriptions after an unexpected disconnect', async () => {
    vi.useFakeTimers();
    const identity = { userId: '1', api: vi.fn().mockResolvedValue({}), validate: vi.fn() };
    const c = new EventSubClient(identity as unknown as TwitchIdentity, vi.fn(), vi.fn());
    c.start();
    state.sockets[0]!.terminate();
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.sockets).toHaveLength(2);
    state.sockets[1]!.emit(
      'message',
      Buffer.from(envelope('session_welcome', { session: { id: 'recovered' } })),
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(identity.api).toHaveBeenCalledTimes(5);
    c.stop();
  });
  it('stops a silent connection and refuses stale events', async () => {
    vi.useFakeTimers();
    const identity = { userId: '1', api: vi.fn().mockResolvedValue({}), validate: vi.fn() };
    const event = vi.fn();
    const c = new EventSubClient(identity as unknown as TwitchIdentity, event, vi.fn());
    c.start();
    const stale = JSON.parse(
      envelope('notification', { subscription: { type: 'channel.chat.message' }, event: {} }),
    );
    stale.metadata.message_timestamp = '2000-01-01T00:00:00Z';
    state.sockets[0]!.emit('message', Buffer.from(JSON.stringify(stale)));
    expect(event).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(41000);
    expect(state.sockets.length).toBeGreaterThan(1);
    c.stop();
  });
});
