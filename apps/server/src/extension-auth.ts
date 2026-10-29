import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const Claims = z.object({
  exp: z.number().int(),
  channel_id: z.string().regex(/^\d+$/),
  user_id: z.string().regex(/^\d+$/).optional(),
  opaque_user_id: z.string().min(2).max(100),
  role: z.enum(['viewer', 'moderator', 'broadcaster']),
});
export function verifyExtensionToken(token: string, secret: string, now = Date.now()) {
  const fail = () =>
    Object.assign(new Error('Extension authentication failed. Reopen the extension.'), {
      statusCode: 401,
    });
  if (!secret || token.length > 8192) throw fail();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw fail();
  try {
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());
    if (header.alg !== 'HS256' || header.crit) throw fail();
    const expected = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const signature = Buffer.from(parts[2]!, 'base64url');
    if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) throw fail();
    const claims = Claims.parse(JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()));
    if (claims.exp * 1000 <= now) throw fail();
    return claims;
  } catch {
    throw fail();
  }
}
