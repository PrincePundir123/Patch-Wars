import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const id = z.string().min(1).max(100);
const Receipt = z.object({
  topic: z.literal('bits_transaction_receipt'),
  exp: z.coerce.number().int(),
  data: z.object({ transactionId: id, userId: z.string().regex(/^\d+$/) }),
});
export function verifyBitsReceipt(token: string, secret: string, now = Date.now()) {
  try {
    if (!secret || token.length > 6000) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part)))
      throw new Error();
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());
    if (header.alg !== 'HS256' || header.crit) throw new Error();
    const expected = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const signature = Buffer.from(parts[2]!, 'base64url');
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected))
      throw new Error();
    const receipt = Receipt.parse(JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()));
    if (receipt.exp * 1000 <= now) throw new Error();
    return receipt.data;
  } catch {
    throw Object.assign(
      new Error('Invalid or expired Twitch transaction receipt. Use transaction recovery.'),
      { statusCode: 401 },
    );
  }
}
const Transaction = z.object({
  id,
  timestamp: z.string().datetime(),
  broadcaster_id: z.string().regex(/^\d+$/),
  user_id: z.string().regex(/^\d+$/),
  product_type: z.literal('BITS_IN_EXTENSION'),
  product_data: z.object({
    sku: z.string().min(1).max(80),
    domain: z.string().max(200),
    cost: z.object({ amount: z.number().int().min(1).max(10000), type: z.literal('bits') }),
    inDevelopment: z.boolean(),
  }),
});
export type BitsTransaction = z.infer<typeof Transaction>;
const Response = z.object({
  data: z.array(Transaction).max(100),
  pagination: z.object({ cursor: z.string().max(1000).optional() }).optional(),
});

// Extension OAuth client secret is separate from its base64 JWT signing secret.
export class TwitchBitsClient {
  private token?: { value: string; until: number };
  private inflight?: Promise<string>;
  constructor(
    private clientId: string,
    private clientSecret: string,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async accessToken() {
    if (this.token && this.token.until > Date.now() + 60000) return this.token.value;
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const response = await this.fetcher('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        }),
      });
      if (!response.ok) throw new Error('Twitch transaction verification is unavailable.');
      const data = z
        .object({
          access_token: z.string().min(1).max(5000),
          expires_in: z.number().int().positive(),
        })
        .parse(await response.json());
      this.token = { value: data.access_token, until: Date.now() + data.expires_in * 1000 };
      return data.access_token;
    })();
    try {
      return await this.inflight;
    } finally {
      this.inflight = undefined;
    }
  }
  private async query(params: URLSearchParams) {
    params.set('extension_id', this.clientId);
    const token = await this.accessToken();
    const response = await this.fetcher(
      `https://api.twitch.tv/helix/extensions/transactions?${params}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Client-Id': this.clientId },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 401) this.token = undefined;
    if (!response.ok)
      throw new Error('Twitch has not confirmed this transaction yet. Try recovery shortly.');
    return Response.parse(await response.json());
  }
  async transaction(transactionId: string) {
    const data = await this.query(new URLSearchParams({ id: transactionId }));
    const transaction = data.data.find((value) => value.id === transactionId);
    if (!transaction) throw new Error('Twitch has not confirmed this transaction yet.');
    return transaction;
  }
  recent(cursor?: string) {
    return this.query(new URLSearchParams({ first: '100', ...(cursor ? { after: cursor } : {}) }));
  }
}
