# Chat and soldier-control repair — October 30, 2026

The supplied screenshot showed a completed battle, disabled soldier cards, a separate viewer sign-in request and Twitch's embedded composer. Deployment is intentionally blocked after a result, but there was no owner rematch action in the expanded view. The broadcaster's existing channel authorization was not being reused for player controls, and the iframe's independent Twitch session made writing chat confusing.

## What changed

- Channel authorization now records which browser session authorized it. `/api/viewer?room=...` can reuse that channel identity for its authorizing session. Owning a match or possessing another operator session does not let someone impersonate its broadcaster. Explicit viewer OAuth remains available for visitors and account switching.
- Soldier cards retain the same server command handler, shared team energy, cooldowns and caps. They remain disabled for finished/paused battles, insufficient energy or missing sign-in. The account name, reconnect action and expired-login errors make the reason visible.
- Owners have Start rematch, Start battle and Resume battle actions in theater. These use the existing ownership-protected control API. A rematch resets/starts the same room and preserves its connected Twitch channels. Ordinary viewers get no host permissions.
- The Stream chat tab has an app-owned composer labelled with the actual sending Twitch account. Its `/api/rooms/:id/chat` request posts through Twitch's Send Chat Message API; the embedded iframe remains the official chat history and an optional alternate composer. This avoids depending on the iframe's login to send from the app. Conversation is allowed between rounds too. Open chat remains available if the browser blocks the embed.
- Send acceptance checks both `is_sent` and a nonempty Twitch message ID, reports moderation/rejection rather than a false success, preserves failed text and enforces the transport cooldown. The API never executes the text as a game command itself: real EventSub delivery is the only game-input path for those chat messages, preventing double deployment.
- Soldier buttons and the Community Forge command field still submit game actions directly, with clearly identified viewer-control receipts. They do not post conversation. The demo composer remains simulated and never posts to Twitch.
- Login state refreshes when the view opens or regains focus. An expired/revoked authorization is surfaced with a sign-in action rather than silently retaining enabled controls. Backend tokens never enter browser responses.

Twitch's [Send Chat Message reference](https://dev.twitch.tv/docs/api/reference/#send-chat-message) documents the existing `user:write:chat` authorization and send/drop response. No extra paid service, Bits economy or persistent match history was added.

## Verification and live evidence

Automated checks cover session-bound broadcaster reuse, no credential borrowing by other visitors/operators, real handler energy deduction, actual transport acceptance/drop handling, cooldowns, expired authorization and EventSub-only command execution with duplicate suppression. Browser checks reproduce a result screen, send a conversation after the result, handle a moderation error without clearing input, start a rematch and deploy from the same theater. External Twitch identity/chat transport is mocked in those browser checks; authoritative room/game state and demo command handling remain real.

The owner supplied a running live match. Public snapshots confirmed princepundir connected and three successful viewer-control deployments: Archer entity 19, Sprinter entity 22 and Bomber entity 23. This confirms the actual soldier-button path was operating during this repair. The match later reached results normally while retaining its Twitch connection. A fresh real Send to Twitch / EventSub receipt is still pending owner participation; no assistant-generated live chat message or new broadcast is claimed.

The initial focused browser run passed nine of eleven cases, including both new player-action checks; two older resize cases timed out during viewport operations. The subsequent fresh-server full run passed all **27 browser cases**, including those resize checks. All **134 automated tests across 28 files**, typecheck, lint and build passed. Final results are also recorded in docs/testing.md. Build warnings for the deferred Pixi chunk and upstream Zod comments remain nonfatal.

The backend update restarts the development watcher, so reconnect Twitch once after updating. Subsequent owner rematches preserve the authorization. Keep the same browser origin throughout authorization and play. A separate Twitch iframe login can differ from the account named on the app-owned chat composer; the label identifies which account will post.
