# Final local verification

Completed October 29, 2026 (IST), following the owner's instruction to continue offline and connect Twitch later.

| Check                       | Observed result                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript           | Passed, no diagnostics                                                                                                  |
| ESLint                      | Passed, no diagnostics                                                                                                  |
| Vitest                      | 87 tests passed in 11 files                                                                                             |
| Playwright                  | Four tests passed: local latency/canvas bounds, desktop/mobile landing, complete Forge/OBS/control flow, operator error |
| Production build            | Server, worker and frontend bundles generated                                                                           |
| Production browser smoke    | Landing and owned demo rendered, one canvas, zero captured browser errors                                               |
| Production dependency audit | No known vulnerabilities after patched @fastify/static and Zod                                                          |
| Full replay                 | Same game state after reset, including Forge, splitting, raid and victory                                               |
| Accelerated soak            | 288,000 ticks / four simulated hours / zero invariant failures                                                          |

The production smoke check caught PixiJS's default dynamic shader compilation conflicting with CSP. The renderer now imports PixiJS's static uniform/shader polyfills; the CSP still disallows unsafe-eval. The follow-up production smoke succeeded.

Forge regression tests verify timeout rejection, ignoring late worker approval, quota enforcement, one active job, worker failure, final schema validation and waiting for entity capacity before reporting deployment.

## Measurements

The fixture evaluation accepted 20/20 representative concepts, rejected 30/30 adversarial inputs and suppressed 1,000/1,000 duplicates. The calibrated slime won 42% of 200 engagements. These fixtures map to four stored blueprints; the dataset is not evidence of general model creativity or production moderation accuracy.

One automated local command reached the proposal UI in approximately 747 ms, including browser automation overhead. Chromium frame samples averaged approximately 39.9 ms with a 50.1 ms p95 during local testing. This does not establish 60 FPS on OBS or live Twitch latency. See browser.json for the raw sample metadata, results.json for Forge timings, and soak.json for the accelerated simulation run.

## Remaining external checks

Real Twitch consent/chat, real AI calls, native Shared Chat, genuine raid footage, hosting, Docker execution, remote CI, pushing commits, YouTube publication and Devpost submission remain unverified. No credentials were fabricated or paid services provisioned.

Build warnings are limited to upstream Zod comment annotations and the large combined frontend chunk; compilation succeeds. Fastify emits a deprecation warning for its request-log disabling option; the currently installed version supports it. These are documented maintenance/performance limitations, not failed checks.
