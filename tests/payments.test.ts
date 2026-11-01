import { createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaidDeployments } from '../apps/server/src/payments/service.js';
import { verifyBitsReceipt, type BitsTransaction } from '../apps/server/src/payments/twitch.js';
import { Room } from '../apps/server/src/room.js';
import { buildApp } from '../apps/server/src/app.js';
import { SOLDIER_PRODUCTS, type DeploymentRecord } from '../packages/shared/src/payments.js';
import { MAX_ENTITIES } from '../packages/game-core/src/index.js';

const secret = Buffer.alloc(32, 19).toString('base64');
const extOrigin = 'https://extension123.ext-twitch.tv';
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
  vi.restoreAllMocks();
});
function token(payload: object, key = secret, alg = 'HS256') {
  const body = [
    Buffer.from(JSON.stringify({ alg })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
  ].join('.');
  return `${body}.${createHmac('sha256', Buffer.from(key, 'base64')).update(body).digest('base64url')}`;
}
function receipt(transactionId: string, userId = '200') {
  return token({
    topic: 'bits_transaction_receipt',
    exp: String(Math.floor(Date.now() / 1000) + 60),
    data: { transactionId, userId },
  });
}
function identity(userId = '200', channelId = '100', role = 'viewer') {
  return token({
    exp: Math.floor(Date.now() / 1000) + 600,
    channel_id: channelId,
    user_id: userId,
    opaque_user_id: `U${userId}`,
    role,
  });
}
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'patchwars-payments-'));
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
  const transactions: BitsTransaction[] = [];
  const request = vi.fn<typeof fetch>(async (url) => {
    if (String(url).includes('/oauth2/token'))
      return Response.json({ access_token: 'fixture-token-never-real', expires_in: 3600 });
    const id = new URL(String(url)).searchParams.get('id');
    return Response.json({
      data: id ? transactions.filter((value) => value.id === id) : transactions,
      pagination: {},
    });
  });
  const config = {
    enabled: true,
    path: join(directory, 'ledger.sqlite'),
    clientSecret: 'fixture-client-secret',
    fetcher: request,
  };
  const service = new PaidDeployments(config, 'extension123', secret);
  cleanups.push(() => service.close());
  const room = new Room('owner', 'live');
  room.paidDeployments = true;
  room.channels = [{ id: '100', name: 'broadcaster', team: 'ember', status: 'connected' }];
  room.start();
  cleanups.push(() => room.dispose());
  return { config, service, room, transactions, request };
}
function transaction(
  intent: DeploymentRecord,
  changes: Partial<BitsTransaction> = {},
): BitsTransaction {
  return {
    id: randomUUID(),
    timestamp: new Date(intent.createdAt + 500).toISOString(),
    broadcaster_id: intent.channelId,
    user_id: intent.userId,
    product_type: 'BITS_IN_EXTENSION',
    product_data: {
      sku: intent.sku,
      domain: 'twitch.ext.extension123',
      cost: { amount: intent.bits, type: 'bits' },
      inDevelopment: false,
    },
    ...changes,
  };
}
describe('paid deployment verification and durable fulfillment', () => {
  it('accepts signed Twitch receipts but rejects expired, forged, malformed and wrong-topic receipts', () => {
    expect(verifyBitsReceipt(receipt('tx'), secret)).toEqual({
      transactionId: 'tx',
      userId: '200',
    });
    for (const value of [
      'bad',
      receipt('tx') + 'x',
      token({
        exp: 1,
        topic: 'bits_transaction_receipt',
        data: { transactionId: 'tx', userId: '200' },
      }),
      token({ exp: Date.now(), topic: 'anything', data: {} }),
      token(
        {
          exp: Date.now(),
          topic: 'bits_transaction_receipt',
          data: { transactionId: 'tx', userId: '200' },
        },
        secret,
        'none',
      ),
    ])
      expect(() => verifyBitsReceipt(value, secret)).toThrow('Invalid or expired');
  });
  it('verifies via Helix, deploys once, and uses no shared team energy', async () => {
    const { service, room, transactions, request } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[1].sku);
    const tx = transaction(intent);
    transactions.push(tx);
    const record = await service.receipt(intent.id, receipt(tx.id), '100', '200');
    expect(record.status).toBe('queued');
    room.game.energy.ember = 0;
    const count = room.game.units.length;
    service.drain([room]);
    expect(room.game.units).toHaveLength(count + 1);
    expect(room.game.units.at(-1)).toMatchObject({ blueprintId: 'archer', team: 'ember' });
    expect(room.game.energy.ember).toBe(0);
    expect((await service.reconcile(intent.id, tx.id, '100', '200')).status).toBe('fulfilled');
    service.drain([room]);
    expect(room.game.units).toHaveLength(count + 1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(service.store!.get(intent.id)?.entityId).toBe(room.game.units.at(-1)!.id);
  });
  it('never accepts browser claims of price, channel, identity, product or test payments', async () => {
    const { service, room, transactions } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[1].sku);
    const tx = transaction(intent, { broadcaster_id: '999' });
    transactions.push(tx);
    await expect(service.reconcile(intent.id, tx.id, '100', '200')).rejects.toThrow(
      'does not match',
    );
    await expect(service.reconcile(intent.id, tx.id, '100', '999')).rejects.toThrow('not found');
    await expect(service.receipt(intent.id, receipt(tx.id, '999'), '100', '200')).rejects.toThrow(
      'another viewer',
    );
    expect(service.store!.get(intent.id)?.status).toBe('confirming');
    expect(() => service.reserve(room, '100', '201', 'generated.unit')).toThrow(
      'approved Bits catalog',
    );
    expect(() => service.reserve(room, '100', '100', SOLDIER_PRODUCTS[0].sku)).toThrow(
      'Broadcasters',
    );
  });
  it.each(['domain', 'inDevelopment', 'sku', 'time'] as const)(
    'rejects a transaction with mismatched %s',
    async (field) => {
      const { service, room, transactions } = fixture();
      const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
      const tx = transaction(intent);
      if (field === 'domain') tx.product_data.domain = 'twitch.ext.other';
      if (field === 'inDevelopment') tx.product_data.inDevelopment = true;
      if (field === 'sku') tx.product_data.sku = SOLDIER_PRODUCTS[2].sku;
      if (field === 'time') tx.timestamp = new Date(intent.createdAt - 60000).toISOString();
      transactions.push(tx);
      await expect(service.reconcile(intent.id, tx.id, '100', '200')).rejects.toThrow(
        'does not match',
      );
      expect(service.store!.get(intent.id)?.transactionId).toBeNull();
    },
  );
  it('holds a genuine price mismatch for broadcaster review rather than losing or spawning it', async () => {
    const { service, room, transactions } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    const tx = transaction(intent);
    tx.product_data.cost.amount = 12;
    transactions.push(tx);
    expect((await service.reconcile(intent.id, tx.id, '100', '200')).status).toBe('review');
    expect(service.store!.get(intent.id)?.note).toContain('12 Bits');
    const count = room.game.units.length;
    service.drain([room]);
    expect(room.game.units).toHaveLength(count);
  });
  it('recovers a completed transaction even when the browser callback never arrives', async () => {
    const { service, room, transactions } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    transactions.push(transaction(intent));
    await service.sync();
    await service.sync();
    expect(service.store!.get(intent.id)?.status).toBe('queued');
    const count = room.game.units.length;
    service.drain([room]);
    expect(room.game.units).toHaveLength(count + 1);
  });
  it('honors a late genuine confirmation after the short confirmation hold expires', async () => {
    const { service, room, transactions } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    const tx = transaction(intent);
    tx.timestamp = new Date(intent.createdAt + 240000).toISOString();
    transactions.push(tx);
    vi.spyOn(Date, 'now').mockReturnValue(intent.createdAt + 241000);
    expect((await service.reconcile(intent.id, tx.id, '100', '200')).status).toBe('queued');
    const count = room.game.units.length;
    service.drain([room]);
    expect(room.game.units).toHaveLength(count + 1);
  });
  it('retains a distinct verified transaction reusing a confirmed intent for review', async () => {
    const { service, room, transactions } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    const first = transaction(intent);
    transactions.push(first);
    await service.reconcile(intent.id, first.id, '100', '200');
    vi.spyOn(Date, 'now').mockReturnValue(intent.createdAt + 2000);
    const second = transaction(intent);
    transactions.push(second);
    const reviewed = await service.reconcile(intent.id, second.id, '100', '200');
    expect(reviewed.status).toBe('review');
    expect(reviewed.id).not.toBe(intent.id);
    expect(service.store!.transaction(first.id)?.id).toBe(intent.id);
    expect(service.store!.transaction(second.id)?.id).toBe(reviewed.id);
  });
  it('closes new activations after a verification outage and reopens them after recovery', async () => {
    const { service, room, request } = fixture();
    service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    request.mockRejectedValueOnce(new Error('Offline fixture.'));
    await service.sync();
    expect(service.display(room, '100', '200').accepting).toBe(false);
    await service.sync();
    expect(service.display(room, '100', '200').accepting).toBe(true);
  });
  it('retains queued actions during pause, full capacity and results, then delivers in the same channel’s next battle', async () => {
    const { service, room, transactions } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    const tx = transaction(intent);
    transactions.push(tx);
    await service.reconcile(intent.id, tx.id, '100', '200');
    room.paused = true;
    service.drain([room]);
    expect(service.store!.get(intent.id)?.status).toBe('queued');
    room.paused = false;
    const original = room.game.units;
    room.game.units = Array.from({ length: MAX_ENTITIES }, () => structuredClone(original[0]!));
    service.drain([room]);
    expect(service.store!.get(intent.id)?.status).toBe('queued');
    room.game.units = original;
    room.game.phase = 'results';
    service.drain([room]);
    const next = new Room('new-owner', 'live');
    next.channels = room.channels;
    next.start();
    cleanups.push(() => next.dispose());
    // The old room must be disconnected, avoiding ambiguous channel-to-match routing.
    room.channels = [];
    const count = next.game.units.length;
    service.drain([room, next]);
    expect(next.game.units).toHaveLength(count + 1);
    expect(service.store!.get(intent.id)?.roomId).toBe(next.id);
  });
  it('survives restart and never automatically repeats an interrupted dispatch', async () => {
    const { service, room, transactions, config } = fixture();
    const intent = service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    const tx = transaction(intent);
    transactions.push(tx);
    await service.reconcile(intent.id, tx.id, '100', '200');
    service.store!.transition(intent.id, 'queued', 'dispatching', 'Interrupted fixture.');
    expect(() => new PaidDeployments(config, 'extension123', secret)).toThrow('already in use');
    service.close();
    const restored = new PaidDeployments(config, 'extension123', secret);
    cleanups.push(() => restored.close());
    expect(restored.store!.get(intent.id)?.status).toBe('review');
    const count = room.game.units.length;
    restored.drain([room]);
    expect(room.game.units).toHaveLength(count);
    restored.store!.resolve(intent.id, 'requeue', '100', 'Inspected: fixture did not deploy.');
    restored.drain([room]);
    expect(room.game.units).toHaveLength(count + 1);
    restored.close();
    const again = new PaidDeployments(config, 'extension123', secret);
    cleanups.push(() => again.close());
    expect((await again.reconcile(intent.id, tx.id, '100', '200')).status).toBe('fulfilled');
    again.drain([room]);
    expect(room.game.units).toHaveLength(count + 1);
  });
  it('stops new activations before match end and retains queue capacity and cooldown limits', () => {
    const { service, room } = fixture();
    service.store!.setAccepting('100', false);
    expect(() => service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku)).toThrow('closed');
    service.store!.setAccepting('100', true);
    service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku);
    expect(() => service.reserve(room, '100', '200', SOLDIER_PRODUCTS[0].sku)).toThrow('cooldown');
    room.game.tick = room.game.durationTicks - 300;
    expect(() => service.reserve(room, '100', '201', SOLDIER_PRODUCTS[0].sku)).toThrow('closed');
    expect(
      () => new PaidDeployments({ enabled: true, path: ':memory:', clientSecret: '' }, '', ''),
    ).toThrow('requires');
  });
});

describe('paid API authorization and command bypass prevention', () => {
  it('blocks every free viewer deployment alias while preserving host, non-deploy commands and demo', () => {
    const { room } = fixture();
    for (const [index, text] of ['!spawn archer', '!attack', '!defend'].entries()) {
      expect(
        room.receive({
          broadcaster_user_id: '100',
          chatter_user_id: `${200 + index}`,
          chatter_user_name: 'Viewer',
          message_id: randomUUID(),
          message: { text },
        }),
      ).toContain('confirmed Bits');
    }
    expect(
      room.receive({
        broadcaster_user_id: '100',
        chatter_user_id: '100',
        chatter_user_name: 'Host',
        message_id: randomUUID(),
        message: { text: '!spawn archer' },
      }),
    ).toBe('Archer deployed.');
    const demo = new Room('demo-owner', 'demo');
    demo.paidDeployments = true;
    demo.start();
    cleanups.push(() => demo.dispose());
    expect(demo.demoCommand('!spawn archer', 'ember')).toBe('Archer deployed.');
  });
  it('requires identity, origin, bound channel and broadcaster privileges at payment boundaries', async () => {
    const { config } = fixture();
    // A distinct persistent ledger for this app's process owner.
    const built = await buildApp({
      clock: false,
      extension: { clientId: 'extension123', secret },
      payments: { ...config, path: config.path + '.api' },
    });
    cleanups.push(() => built.app.close());
    const room = new Room('unrelated-owner', 'live');
    room.paidDeployments = true;
    room.channels = [{ id: '100', name: 'Host', team: 'ember', status: 'connected' }];
    room.start();
    built.rooms.set(room.id, room);
    const headers = { origin: extOrigin, authorization: `Bearer ${identity()}` };
    const payload = { roomId: room.id, sku: SOLDIER_PRODUCTS[0].sku };
    const state = await built.app.inject({ url: '/api/extension/state', headers });
    expect(state.json().payments).toMatchObject({ enabled: true, accepting: true });
    for (const [auth, requestOrigin, expected] of [
      [identity('200', '999'), extOrigin, 409],
      ['forged', extOrigin, 401],
      [identity(), 'https://evil.invalid', 403],
    ] as const) {
      expect(
        (
          await built.app.inject({
            method: 'POST',
            url: '/api/extension/payments/intents',
            headers: { origin: requestOrigin, authorization: `Bearer ${auth}` },
            payload,
          })
        ).statusCode,
      ).toBe(expected);
    }
    const intent = await built.app.inject({
      method: 'POST',
      url: '/api/extension/payments/intents',
      headers,
      payload,
    });
    expect(intent.statusCode).toBe(200);
    expect(
      (
        await built.app.inject({
          method: 'POST',
          url: '/api/extension/payments/intents',
          headers,
          payload: { ...payload, bits: 1 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await built.app.inject({
          method: 'POST',
          url: '/api/extension/payments/admin',
          headers,
          payload: { action: 'accepting', channelId: '100', accepting: false },
        })
      ).statusCode,
    ).toBe(403);
    const hostHeaders = {
      origin: extOrigin,
      authorization: `Bearer ${identity('100', '100', 'broadcaster')}`,
    };
    expect(
      (
        await built.app.inject({
          method: 'POST',
          url: '/api/extension/payments/admin',
          headers: hostHeaders,
          payload: { action: 'accepting', channelId: '100', accepting: false },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await built.app.inject({ url: '/api/extension/state', headers })).json().payments.accepting,
    ).toBe(false);
    expect((await built.app.inject({ url: `/api/rooms/${room.id}/payments` })).statusCode).toBe(
      403,
    );
    const free = await built.app.inject({
      method: 'POST',
      url: '/api/extension/command',
      headers,
      payload: { roomId: room.id, text: '!spawn archer', requestId: randomUUID() },
    });
    expect(free.json().message).toContain('confirmed Bits');
  });
});
