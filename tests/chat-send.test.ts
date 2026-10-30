import { expect, it, vi } from 'vitest';
import { TwitchIdentity } from '../packages/twitch-adapter/src/index.js';
function identity() {
  const actor = new TwitchIdentity({
    clientId: 'test',
    clientSecret: 'test',
    redirectUri: 'http://localhost',
  });
  actor.userId = '200';
  return actor;
}
it('checks Twitch is_sent and uses the authenticated sender instead of assuming a 200 means success', async () => {
  const actor = identity();
  const api = vi
    .spyOn(actor, 'api')
    .mockResolvedValue({ data: [{ message_id: 'chat-one', is_sent: true }] });
  expect(await actor.sendChat('100', 'hello')).toEqual({ messageId: 'chat-one' });
  expect(api).toHaveBeenCalledWith('chat/messages', {
    broadcaster_id: '100',
    sender_id: '200',
    message: 'hello',
  });
  await expect(actor.sendChat('100', 'too fast')).rejects.toThrow('cooldown');
  expect(api).toHaveBeenCalledOnce();
});
it('reports Twitch moderation/drop failures and malformed acceptance without a false sent receipt', async () => {
  const dropped = identity();
  vi.spyOn(dropped, 'api').mockResolvedValue({
    data: [
      {
        message_id: '',
        is_sent: false,
        drop_reason: { code: 'automod_held', message: 'Held for moderation' },
      },
    ],
  });
  await expect(dropped.sendChat('100', 'test')).rejects.toThrow('Held for moderation');
  const missing = identity();
  vi.spyOn(missing, 'api').mockResolvedValue({ data: [{ message_id: '', is_sent: true }] });
  await expect(missing.sendChat('100', 'test')).rejects.toThrow('did not send');
});
it('preserves expired authorization as a 401 when Twitch rejects a refresh', async () => {
  let issued = false;
  const request = vi.fn(async (input: unknown) => {
    if (String(input).endsWith('/validate'))
      return new Response(
        JSON.stringify({
          client_id: 'test',
          user_id: '200',
          login: 'viewer',
          scopes: ['user:read:chat', 'user:write:chat'],
          expires_in: 3600,
        }),
      );
    if (String(input).endsWith('/token') && !issued) {
      issued = true;
      return new Response(
        JSON.stringify({
          access_token: 'fake-test-token',
          refresh_token: 'fake-test-refresh',
          expires_in: 3600,
        }),
      );
    }
    return new Response('', { status: 401 });
  });
  const actor = new TwitchIdentity(
    { clientId: 'test', clientSecret: 'test', redirectUri: 'http://localhost' },
    request,
  );
  await actor.exchange('test-code');
  await expect(actor.api('chat/messages', { message: 'test' })).rejects.toMatchObject({
    statusCode: 401,
  });
});
