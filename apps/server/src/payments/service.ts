import {
  SOLDIER_PRODUCTS,
  type DeploymentRecord,
  type PaymentDisplay,
} from '../../../../packages/shared/src/payments.js';
import { MAX_ENTITIES, spawn } from '../../../../packages/game-core/src/index.js';
import type { Room } from '../room.js';
import { PaymentStore } from './store.js';
import { TwitchBitsClient, type BitsTransaction, verifyBitsReceipt } from './twitch.js';

export type PaymentsConfig = {
  enabled: boolean;
  path: string;
  clientSecret: string;
  fetcher?: typeof fetch;
};
export class PaidDeployments {
  readonly store?: PaymentStore;
  private client?: TwitchBitsClient;
  private cursor?: string;
  private newest = true;
  private syncing = false;
  private syncingFailed = false;
  private storageFailed = false;
  private closed = false;
  private users = new Map<string, number>();
  private drainAt = new Map<string, number>();
  private checking = new Set<string>();
  constructor(
    readonly config: PaymentsConfig,
    private clientId: string,
    private secret: string,
  ) {
    if (config.enabled) {
      if (
        !clientId ||
        !secret ||
        !config.clientSecret ||
        !config.path ||
        config.path === ':memory:'
      )
        throw new Error(
          'Paid deployment requires Extension credentials and a persistent PAYMENTS_DB_PATH.',
        );
      this.store = new PaymentStore(config.path);
      this.client = new TwitchBitsClient(clientId, config.clientSecret, config.fetcher);
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.store?.close();
  }
  private requireStore() {
    if (!this.store || !this.client || this.closed || this.storageFailed)
      throw Object.assign(new Error('Bits deployment is not configured.'), { statusCode: 503 });
    return this.store;
  }
  display(room: Room, channelId: string, userId?: string): PaymentDisplay {
    const enabled = room.mode === 'live' && !!this.store;
    const accepting =
      enabled &&
      !this.syncingFailed &&
      !!this.store?.accepting(channelId) &&
      !room.paused &&
      room.commandsEnabled &&
      room.game.phase === 'battle' &&
      room.game.durationTicks - room.game.tick > 300;
    return {
      enabled,
      accepting,
      acceptingEnabled: enabled && !!this.store?.accepting(channelId),
      message: !enabled
        ? 'Free team-energy deployment. Bits are disabled.'
        : accepting
          ? 'One activation deploys one soldier. Confirmed actions wait for space or the next battle on this channel.'
          : 'New Bits activations are closed. Confirmed reinforcements remain queued.',
      products: enabled ? [...SOLDIER_PRODUCTS] : [],
      records:
        enabled && userId
          ? this.store!.records(channelId, userId === channelId ? undefined : userId)
          : [],
    };
  }
  reserve(room: Room, channelId: string, userId: string, sku: string) {
    const store = this.requireStore();
    if (!this.display(room, channelId, userId).accepting)
      throw new Error('New Bits activations are closed.');
    if (userId === channelId)
      throw new Error('Broadcasters deploy through their free host controls.');
    const product = SOLDIER_PRODUCTS.find((value) => value.sku === sku);
    if (!product || !room.game.catalog[product.unitId])
      throw new Error('This soldier is not in the approved Bits catalog.');
    return store.reserve(channelId, userId, room.id, product);
  }
  private ownedIntent(intentId: string, channelId: string, userId: string) {
    const intent = this.requireStore().get(intentId);
    if (!intent || intent.channelId !== channelId || intent.userId !== userId)
      throw Object.assign(new Error('Activation not found.'), { statusCode: 404 });
    return intent;
  }
  async receipt(intentId: string, receipt: string, channelId: string, userId: string) {
    const value = verifyBitsReceipt(receipt, this.secret);
    if (value.userId !== userId)
      throw Object.assign(new Error('This transaction belongs to another viewer.'), {
        statusCode: 403,
      });
    return this.reconcile(intentId, value.transactionId, channelId, userId);
  }
  async reconcile(intentId: string, transactionId: string, channelId: string, userId: string) {
    const intent = this.ownedIntent(intentId, channelId, userId);
    if (intent.transactionId === transactionId) return intent;
    const key = `${channelId}:${userId}`;
    const now = Date.now();
    if (
      this.checking.size >= 8 ||
      this.checking.has(key) ||
      now - (this.users.get(key) ?? 0) < 1500
    )
      throw new Error('Transaction verification is busy. Try again shortly.');
    if (this.users.size >= 2000)
      for (const [id, at] of this.users) if (now - at > 60000) this.users.delete(id);
    if (this.users.size >= 2000 && !this.users.has(key))
      throw new Error('Transaction verification is busy. Try again shortly.');
    this.users.set(key, now);
    this.checking.add(key);
    try {
      return this.confirm(intent, await this.client!.transaction(transactionId));
    } finally {
      this.checking.delete(key);
    }
  }
  private confirm(intent: DeploymentRecord, transaction: BitsTransaction) {
    const store = this.requireStore();
    const timestamp = Date.parse(transaction.timestamp);
    if (
      transaction.user_id !== intent.userId ||
      transaction.broadcaster_id !== intent.channelId ||
      transaction.product_data.domain !== `twitch.ext.${this.clientId}` ||
      transaction.product_data.inDevelopment ||
      transaction.product_data.sku !== intent.sku ||
      timestamp < intent.createdAt - 5000 ||
      timestamp > Date.now() + 5000
    )
      throw Object.assign(new Error('The Twitch transaction does not match this activation.'), {
        statusCode: 403,
      });
    const existing = store.transaction(transaction.id);
    if (existing) return existing;
    if (intent.status !== 'confirming') {
      return store.additionalReview(intent, transaction.id, transaction.product_data.cost.amount);
    }
    const amount = transaction.product_data.cost.amount;
    return store.confirm(
      intent.id,
      transaction.id,
      amount,
      amount !== intent.bits
        ? `Twitch confirmed ${amount} Bits; expected ${intent.bits}. Inspect the catalog before resolving.`
        : undefined,
    );
  }
  // Reconcile missed callbacks using Twitch's authoritative transaction list. One bounded
  // page per interval; alternate newest pages and backlog pages to avoid starvation.
  async sync() {
    if (!this.store || this.closed || this.syncing) return;
    if (!this.store.pending().length && !this.syncingFailed) return;
    this.syncing = true;
    try {
      const pending = this.store.pending();
      const page = await this.client!.recent(this.newest ? undefined : this.cursor);
      if (this.closed) return;
      for (const transaction of page.data) {
        const intent = pending.find(
          (value) =>
            value.channelId === transaction.broadcaster_id &&
            value.userId === transaction.user_id &&
            value.sku === transaction.product_data.sku &&
            Date.parse(transaction.timestamp) >= value.createdAt - 5000,
        );
        if (intent) {
          try {
            this.confirm(intent, transaction);
            pending.splice(pending.indexOf(intent), 1);
          } catch {
            /* Leave mismatches unfulfilled for operator inspection. */
          }
        }
      }
      if (!this.newest || !this.cursor) this.cursor = page.pagination?.cursor;
      if (
        page.data.length &&
        Date.parse(page.data.at(-1)!.timestamp) <
          Math.min(...pending.map((value) => value.createdAt)) - 5000
      )
        this.cursor = undefined;
      this.newest = !this.newest;
      this.syncingFailed = false;
    } catch {
      this.syncingFailed = true;
      this.cursor = undefined;
    } finally {
      this.syncing = false;
    }
  }
  drain(rooms: Iterable<Room>) {
    if (this.storageFailed) return;
    try {
      this.deliver(rooms);
    } catch {
      this.storageFailed = true;
      this.syncingFailed = true;
    }
  }
  private deliver(rooms: Iterable<Room>) {
    if (!this.store || this.closed) return;
    const active = [...rooms].filter((room) => room.mode === 'live');
    const channels = new Set(active.flatMap((room) => room.channels.map((channel) => channel.id)));
    for (const key of this.drainAt.keys()) if (!channels.has(key)) this.drainAt.delete(key);
    for (const room of active) {
      if (room.paused || !room.commandsEnabled || room.game.phase !== 'battle') continue;
      for (const channel of room.channels.filter((value) => value.status.startsWith('connected'))) {
        if (
          active.filter((value) =>
            value.channels.some((c) => c.id === channel.id && c.status.startsWith('connected')),
          ).length !== 1
        )
          continue;
        if (Date.now() - (this.drainAt.get(channel.id) ?? 0) < 500) continue;
        if (room.game.units.length >= MAX_ENTITIES) continue;
        const record = this.store.queued(channel.id)[0];
        if (!record || !room.game.catalog[record.unitId]) continue;
        if (
          !this.store.transition(record.id, 'queued', 'dispatching', 'Delivery started.', room.id)
        )
          continue;
        const before = structuredClone(room.game);
        try {
          const entityId = room.game.nextId;
          if (!spawn(room.game, channel.team, record.unitId, true)) {
            this.store.transition(
              record.id,
              'dispatching',
              'queued',
              'Waiting for battlefield capacity.',
            );
            continue;
          }
          if (
            !this.store.transition(
              record.id,
              'dispatching',
              'fulfilled',
              'Soldier deployed.',
              room.id,
              entityId,
            )
          )
            throw new Error('Ledger update failed.');
          room.note(
            `A viewer activated ${room.game.catalog[record.unitId]!.name} for ${room.teamNames[channel.team]}.`,
          );
          this.drainAt.set(channel.id, Date.now());
        } catch {
          room.game = before;
          // Do not retry uncertain delivery automatically; a failed DB write may have committed.
          try {
            this.store.transition(
              record.id,
              'dispatching',
              'review',
              'Delivery interrupted; operator review required.',
            );
          } catch {
            /* Durable dispatching state is reviewed on restart. */
            this.storageFailed = true;
            this.syncingFailed = true;
          }
        }
      }
    }
  }
}
