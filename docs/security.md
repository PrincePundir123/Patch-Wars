# Security model

Treat chat, generated output, OAuth, HTTP and EventSub as untrusted.

| Boundary       | Implemented control                                                                       |
| -------------- | ----------------------------------------------------------------------------------------- |
| Admin          | Owned sessions, exact Origin, operator key for live creation                              |
| OAuth          | Random one-use session-bound state, expiry, server exchange, scope/client/user validation |
| Tokens         | Memory-only, HttpOnly SameSite cookie, Secure in production, absent from snapshots        |
| HTTP           | 8 KB body limit, strict schemas, rate limit, no-store responses                           |
| Sockets        | Read-only, origin check, 1 KB input, spectator/buffer caps                                |
| Commands/votes | Source dedupe, stable IDs, cooldowns, one effective vote                                  |
| Forge          | Size/stat/operation/resource limits, timeout and job quotas                               |
| Interpreter    | No eval, Function, VM, generated imports or arbitrary URLs                                |
| Renderer       | React text and fixed geometric art; no untrusted HTML                                     |

Workers execute trusted application code. Threads are not an OS sandbox. The worker environment excludes Twitch credentials. Prefer no-tool Responses for live generation.

## Codex isolation gate

Do not set `CODEX_ISOLATED=true` on an ordinary host. The SDK can invoke a general-purpose subprocess; a read-only working directory does not prevent other filesystem reads. Before enabling, verify a dedicated container/user boundary without host mounts or Twitch credentials, minimal filesystem, constrained egress, process/CPU/memory limits and provider-only network access. Post-hoc rejection of tool use is not isolation. This runtime mode remains disabled/unverified in the delivered configuration.

Local moderation is conservative and English-oriented, not comprehensive multilingual safety. Operators must supervise public proposals. Generated names/descriptions are filtered again before publication. Operator keys are private bootstrap secrets; use 32 random characters or more. Public match links allow viewing only.

State/tokens disappear on restart. No plaintext credential database exists. Use one HTTPS backend behind a trusted proxy. The Dockerfile has not been executed in this Windows environment.

The production dependency audit originally flagged @fastify/static and Zod; they were upgraded and the subsequent audit found no known vulnerabilities. Repeat before deployment. This is not a penetration-test or complete-security claim.

## Development-origin policy

Development permits WEB_ORIGIN and the exact http://localhost:5173 / http://127.0.0.1:5173 origins. Production permits only WEB_ORIGIN. There are no wildcard domains, arbitrary local ports or trusted forwarded-host exceptions. Mutations without Origin remain blocked; read-only non-browser WebSocket tooling retains its existing behavior. Origin acceptance does not grant operator access or ownership.

An explicit OAuth origin is accepted only from this allowlist and is bound to one-use state. Exchange uses that same callback. Public-origin invitations remain one-use and do not share operator cookies between domains. Canonical origin configuration rejects credentials, non-HTTP schemes, paths, query strings and fragments.

## Viewer controls and native extension

Viewer OAuth uses separate session-bound, expiring, one-use state through the existing exact callback. It records viewer identity without granting operator status or room ownership. Viewer commands require a valid server session and a connected channel in the target live match; identities are revalidated after five minutes of activity. The channel's authorizing session may reuse its own broadcaster identity for that room; room ownership alone or a different operator session cannot borrow the broadcaster token. Tokens remain server-side and disappear with the session/restart. Soldier cards and Forge controls submit game actions directly. The separate Stream chat composer sends actual Twitch messages under the named authorized identity, checks Twitch send acceptance, and leaves command execution solely to EventSub. Host rematch/resume actions still require room ownership.

Native extension APIs accept only verified HS256 Twitch Extension JWTs using a separate base64 signing secret. Expiry, role, channel and linked user ID are checked. Anonymous viewers may read extension state but cannot send commands. The server derives the team from the token's participating channel and rejects client team fields. Requests use UUIDs for deduplication and share actual Twitch user IDs/cooldowns with chat. No Bits transactions are implemented.

Only `/api/extension/*` accepts the configured extension's exact `https://<client-id>.ext-twitch.tv` origin, with token verification still required. Other mutations retain the existing origin/ownership rules. Only static `/extension/*` assets allow Twitch framing and the official helper in their CSP; the dashboard remains self-framed. Official Twitch chat frames are permitted on web pages, and are loaded on request. Backend secrets are excluded from the extension build. Display input is validated and rendered through text nodes. See [setup and external verification requirements](live-experience.md).
