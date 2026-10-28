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
