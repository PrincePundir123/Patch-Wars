import { createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { buildApp } from '../apps/server/src/app.js';
import { Room } from '../apps/server/src/room.js';
import { SOLDIER_PRODUCTS, type DeploymentRecord } from '../packages/shared/src/payments.js';
import type { BitsTransaction } from '../apps/server/src/payments/twitch.js';

const secret = Buffer.alloc(32, 23).toString('base64');
function sign(payload: object) {
  const body = [
    Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
  ].join('.');
  return `${body}.${createHmac('sha256', Buffer.from(secret, 'base64')).update(body).digest('base64url')}`;
}
const scenario = 'confirm' as const;
{
  test('film: Extension Bits purchase, paced for the camera', async ({
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
      await page.route('**/extension/viewer.html', (route) =>
        route.fulfill({ contentType: 'text/html', body: readFileSync('apps/extension/viewer.html', 'utf8') }),
      );
      await page.route('**/extension/viewer.css', (route) =>
        route.fulfill({ contentType: 'text/css', body: readFileSync('apps/extension/viewer.css', 'utf8') }),
      );
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
      // The extension is a video overlay: show it over the battlefield art, as it sits over the stream on Twitch.
      await page.addStyleTag({
        content: `html,body{background:#000 url(/art/castle-lane.webp) center 80%/cover no-repeat!important}
          #rec-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
          background:rgba(242,193,78,.3);box-shadow:0 0 0 2px rgba(242,193,78,.95),0 0 24px 6px rgba(242,193,78,.25);
          pointer-events:none;z-index:2147483647}`,
      });
      await page.evaluate(() => {
        const dot = Object.assign(document.createElement('div'), { id: 'rec-cursor' });
        document.body.append(dot);
        addEventListener('mousemove', (e) => (dot.style.translate = `${e.clientX}px ${e.clientY}px`), true);
      });
      const button = page.getByRole('button', { name: 'Activate Archer · 20 Bits', exact: true });
      await expect(button).toBeEnabled();
      const OUT = `${process.env.HOME}/Videos/patchwars/clips`;
      const FRAMES = `${OUT}/frames-bits`;
      mkdirSync(FRAMES, { recursive: true });
      const cdp = await page.context().newCDPSession(page);
      const frames: { file: string; t: number }[] = [];
      let t0: number | null = null;
      cdp.on('Page.screencastFrame', async (f) => {
        const t = f.metadata.timestamp!;
        if (t0 === null) t0 = t;
        const file = `${FRAMES}/${String(frames.length).padStart(5, '0')}.jpg`;
        writeFileSync(file, Buffer.from(f.data, 'base64'));
        frames.push({ file, t: t - t0 });
        await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080 });
      const marks: Record<string, number> = {};
      const mark = (k: string) => (marks[k] = t0 === null ? 0 : Date.now() / 1000 - t0);
      await page.mouse.move(900, 200);
      await page.waitForTimeout(1200);
      mark('start');
      const box = (await button.boundingBox())!;
      for (let i = 1; i <= 30; i++) {
        const k = 1 - Math.pow(1 - i / 30, 3);
        await page.mouse.move(900 + (box.x + box.width / 2 - 900) * k, 200 + (box.y + box.height / 2 - 200) * k);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(500);
      mark('click');
      await button.click();
      await expect.poll(() => room.game.spawned).toBeGreaterThanOrEqual(11);
      await expect(page.locator('#payment-history')).toContainText('fulfilled');
      mark('fulfilled');
      await page.waitForTimeout(3500);
      mark('end');
      await cdp.send('Page.stopScreencast');
      frames.sort((a, b) => a.t - b.t);
      const lastUntil = Math.max(frames.at(-1)!.t + 0.5, marks.end ?? 0);
      const list = frames
        .map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? lastUntil) - f.t).toFixed(4)}`)
        .join('\n');
      writeFileSync(`${FRAMES}/list.txt`, `${list}\nfile '${frames.at(-1)!.file}'\n`);
      spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${FRAMES}/list.txt`, '-vf',
        'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '16', `${OUT}/bits.mp4`]);
      writeFileSync(`${OUT}/bits.marks.json`, JSON.stringify(marks, null, 1));
    } finally {
      await built.app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
