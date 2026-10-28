# Twitch integration

Official documentation checked October 28, 2026. Implemented and contract-tested; real authorization and stream verification remain owner acceptance tasks.

## OAuth

The confidential [authorization-code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow) uses random one-use state bound to the initiating browser session, expiring after ten minutes. Code exchange, client/user/scope validation and token storage are server-side. The documented flow used here does not specify PKCE parameters; unsupported PKCE behavior is not claimed.

Scopes: `user:read:chat`, `user:write:chat`. Each broadcaster authorizes their own channel. [Validation](https://dev.twitch.tv/docs/authentication/validate-tokens/) runs initially and every 55 minutes. Refresh is serialized and retries one 401. Revocation stops the connection; disconnect revokes the token.

## EventSub and attribution

The adapter subscribes after welcome at `wss://eventsub.wss.twitch.tv/ws`, handles keepalives, health timeout, migration, backoff and revocation, and validates reconnect hostnames. Notifications have size, schema, timestamp and duplicate checks. No webhook endpoint is exposed. See [protocol](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/) and [subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

Core: `channel.chat.message` v1. Optional: `channel.raid` v1 and `channel.shared_chat.begin/update/end` v1. Missing events during disconnect cannot be replayed by Twitch.

Source channel = `source_broadcaster_user_id ?? broadcaster_user_id`; dedupe identity = source channel + `source_message_id ?? message_id`. Replicated messages count once for the original channel's team. Unknown source channels are ignored. Stable Twitch IDs drive votes/cooldowns. Viewer display names are not published.

Shared Chat lifecycle rejects older timestamps. Single-channel and separate-channel modes are labelled. The app does not create native Shared Chat or assume raids join it. Broadcasters arrange Shared Chat through Twitch when available. Participant reconciliation is limited to events delivered for the participating channels.

## Replies and commands

Replies use [Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message) with a user token. `for_source_only` is omitted because of its token-type restrictions. Shared delivery follows Twitch semantics. Replies are capped at one per channel per two seconds and fifteen per thirty seconds per identity; excess replies are dropped.

Commands: `!join`, `!spawn [unit-id]`, `!attack`, `!defend`, `!forge <idea>`, `!vote p1`, `!units`, `!score`, `!help`.

Limits: 220 characters; 180-character concepts; one command/user/1.5 seconds; 50/channel/second; 100/room/second. Attack spends energy on a sprinter; defend on a guardian. Only catalog units spawn. Operators can disable commands/Forge and moderate proposals before voting.

Raids use validated destination identity and deduped delivery ID. Strength is `min(8, max(1, floor(log2(max(1, viewers))) + 1))`, alternating sprinters/guardians. Individual raiders are not inferred.

## Live acceptance

Authorize a channel, record a real spawn command, propose/vote/forge, reconnect the browser, invite a second broadcaster and verify source attribution. Record real Twitch footage with the provider label visible. Fixtures do not satisfy this acceptance.
