import { createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { buildApp } from '../../apps/server/src/app.js';
import { Room } from '../../apps/server/src/room.js';
import { SOLDIER_PRODUCTS, type DeploymentRecord } from '../../packages/shared/src/payments.js';
import type { BitsTransaction } from '../../apps/server/src/payments/twitch.js';

const secret = Buffer.alloc(32, 23).toString('base64');
function sign(payload: object) {
  const body = [
    Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
  ].join('.');
  return `${body}.${createHmac('sha256', Buffer.from(secret, 'base64')).update(body).digest('base64url')}`;
}
for (const scenario of ['confirm', 'cancel', 'unavailable'] as const) {
  test(`Extension Bits action ${scenario} uses the real API and fulfillment ledger`, async ({
    page,
    baseURL,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), 'patchwars-bits-browser-'));
    const transactions: BitsTransaction[] = [];
    let intent: DeploymentRecord | undefined;
    const built = await buildApp({
      webOrigin: baseURL!,
      extension: { clientId: 'browserextension', secret },
      payments: {
        enabled: true,
        path: join(directory, 'ledger.sqlite'),
        clientSecret: 'fixture-secret-not-live',
        fetcher: async (url) =>
          String(url).includes('/oauth2/token')
            ? Response.json({ access_token: 'fixture-access-token', expires_in: 3600 })
            : Response.json({ data: transactions, pagination: {} }),
      },
    });
    const room = new Room('fixture-owner', 'live');
    room.channels = [{ id: '100', name: 'fixturehost', team: 'ember', status: 'connected' }];
    room.paidDeployments = true;
    room.start();
    built.rooms.set(room.id, room);
    const jwt = sign({
      exp: Math.floor(Date.now() / 1000) + 600,
      channel_id: '100',
      user_id: '200',
      opaque_user_id: 'U200',
      role: 'viewer',
    });
    try {
      // Compile the real frontend for this isolated test origin. The production
      // build may legitimately target a different operator/tunnel origin.
      const frontend = await build({
        entryPoints: ['apps/extension/viewer.ts'],
        bundle: true,
        write: false,
        platform: 'browser',
        format: 'iife',
        define: { PATCH_WARS_BACKEND: JSON.stringify(baseURL) },
      });
      await page.route('**/extension/viewer.js', (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: frontend.outputFiles[0]!.text,
        }),
      );
      await page.route('https://extension-files.twitch.tv/**', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: '' }),
      );
      await page.route('**/api/extension/**', async (route) => {
        const request = route.request();
        const response = await built.app.inject({
          method: request.method() as 'GET' | 'POST',
          url: new URL(request.url()).pathname,
          headers: { origin: baseURL!, authorization: request.headers().authorization ?? '' },
          ...(request.method() === 'POST' ? { payload: request.postDataJSON() } : {}),
        });
        if (request.url().endsWith('/intents') && response.statusCode === 200)
          intent = response.json();
        await route.fulfill({
          status: response.statusCode,
          headers: {
            'access-control-allow-origin': baseURL!,
            'access-control-allow-headers': 'Authorization, Content-Type',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
          },
          contentType: 'application/json',
          body: response.body,
        });
      });
      await page.exposeFunction('fixtureTransaction', () => {
        if (!intent) throw new Error('No server-authorized intent.');
        const id = randomUUID();
        transactions.push({
          id,
          timestamp: new Date().toISOString(),
          broadcaster_id: '100',
          user_id: '200',
          product_type: 'BITS_IN_EXTENSION',
          product_data: {
            sku: intent.sku,
            domain: 'twitch.ext.browserextension',
            cost: { amount: intent.bits, type: 'bits' },
            inDevelopment: false,
          },
        });
        return {
          initiator: 'current_user',
          transactionID: id,
          transactionReceipt: sign({
            topic: 'bits_transaction_receipt',
            exp: Math.floor(Date.now() / 1000) + 60,
            data: { transactionId: id, userId: '200' },
          }),
        };
      });
      await page.addInitScript(
        ({ jwt, scenario, products }) => {
          type Transaction = {
            initiator: string;
            transactionID: string;
            transactionReceipt: string;
          };
          const fixture = window as unknown as {
            Twitch: unknown;
            fixtureTransaction: () => Promise<Transaction>;
          };
          let complete: (value: Transaction) => void = () => {};
          let cancel: () => void = () => {};
          fixture.Twitch = {
            ext: {
              onAuthorized: (callback: (value: object) => void) =>
                callback({ token: jwt, channelId: '100', clientId: 'browserextension' }),
              onVisibilityChanged: () => {},
              actions: { requestIdShare: () => {} },
              features: { isBitsEnabled: scenario !== 'unavailable', onChanged: () => {} },
              bits: {
                getProducts: async () =>
                  products.map((value) => ({
                    sku: value.sku,
                    cost: { amount: String(value.bits), type: 'bits' },
                  })),
                onTransactionComplete: (callback: typeof complete) => {
                  complete = callback;
                },
                onTransactionCancelled: (callback: typeof cancel) => {
                  cancel = callback;
                },
                useBits: () =>
                  scenario === 'cancel'
                    ? cancel()
                    : void fixture.fixtureTransaction().then(complete),
              },
            },
          };
        },
        { jwt, scenario, products: SOLDIER_PRODUCTS },
      );
      await page.goto('/extension/viewer.html');
      const button = page.getByRole('button', { name: 'Activate Archer · 20 Bits', exact: true });
      await expect(button).toBeVisible();
      if (scenario === 'unavailable') {
        await expect(button).toBeDisabled();
        expect(transactions).toHaveLength(0);
      } else {
        await expect(button).toBeEnabled();
        await button.click();
        if (scenario === 'cancel') {
          await expect(page.locator('#status')).toContainText('canceled');
          expect(transactions).toHaveLength(0);
          expect(room.game.spawned).toBe(10);
        } else {
          await expect.poll(() => room.game.spawned).toBeGreaterThanOrEqual(11);
          await expect(page.locator('#payment-history')).toContainText('fulfilled');
          expect(transactions).toHaveLength(1);
          await page.getByText('Forge & commands', { exact: true }).click();
          await page.getByLabel('Game command').fill('!spawn archer');
          await page.getByRole('button', { name: 'Send', exact: true }).click();
          await expect(page.locator('#status')).toContainText('confirmed Bits');
          const confirmed = await built.app.inject({
            url: '/api/extension/state',
            headers: { authorization: `Bearer ${jwt}` },
          });
          expect(
            confirmed
              .json()
              .payments.records.filter((record: DeploymentRecord) => record.status === 'fulfilled'),
          ).toHaveLength(1);
          await page.evaluate(() => {
            const badge = document.createElement('p');
            badge.textContent = 'TWITCH EXTENSION TEST - NO REAL BITS';
            badge.style.cssText =
              'position:fixed;top:8px;left:8px;color:white;background:#222;padding:12px';
            document.body.append(badge);
          });
          await page.screenshot({ path: 'docs/screenshots/paid-deployment-fixture.png' });
        }
      }
    } finally {
      await built.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
