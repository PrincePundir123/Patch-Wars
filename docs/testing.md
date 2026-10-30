# Testing

Chat dock follow-up: all **138 unit/integration tests** and the full **30-case browser suite** passed on the final isolated built-server run (3.4 minutes). Typecheck, lint and build passed. Two new browser cases reproduce native-menu sizing, keyboard/native-history scrolling, expansion, retained drafts/iframe, focus return and unchanged paused game state across desktop, short landscape, portrait and 320 px layouts. Real read-only Twitch settings captures supplement the mocked tests; no new real message send is claimed. See [chat dock repair](chat-dock.md).

Sunstone visual update: **138 unit/integration tests across 29 files** and the full **28-case browser suite** passed. Typecheck, lint, web/server build and extension build passed. The new browser case observes real sprite pose progression, a retained canvas through portrait camera switching, actual fixture deployment, and pause with unchanged authoritative game state. Browser-rendered desktop/phone screenshots, an actual fixture-motion recording and the combined visual review are linked in [Sunstone implementation](sunstone-battleground.md) and [design QA](../design-qa.md). An initial pause-counter assertion sampled before the periodic diagnostic flush; the final case allows that window to settle before asserting freeze. No gameplay timing was changed to satisfy it.

Earlier chat/control repair verification: **134 tests across 28 files** and **27 browser tests** passed. The suite covers existing app flows, match closure, expanded viewing, the stream stage, native extension frontend, readiness, renderer recovery and owner rematch/chat/expired-account flows. Earlier evidence remains in [Field Studio verification](field-studio-verification.md), [priority improvements](priority-improvements.md), [live experience](live-experience.md) and [chat/control repair](chat-controls-repair.md). Follow the [manual rehearsal](manual-rehearsal.md) for demo and actual Twitch/OBS checks.

Chat repair unit tests verify session-bound broadcaster reuse, visitor isolation, accepted/dropped Twitch transport responses, cooldown and 401 behavior, and no double execution of API-posted commands before EventSub delivery. The latest UI removes the custom live chat composer. Updated browser scenarios verify two initially collapsed icon toggles, independent panels, retained canvas/iframe, exactly one official live chat embed, no custom chat form or chat-send API calls, owner reset/start/deployment and recovery from expired soldier authorization. Twitch identity and iframe contents are mocked; actual Twitch browser login/message delivery is not established by those checks. The focused 11 browser cases, typecheck, lint, all 134 unit/integration tests and both builds passed. Actual live soldier clicks from the earlier repair remain recorded in the owner-provided match.

Theater now uses the shared stream-stage layout rather than the old battlefield-only expansion. Tests enter through the existing dashboard button, assert soldier controls/chat on the unchanged match URL, retain the canvas and label state, compare the complete paused game before/after, check focus containment/return and exercise native fullscreen and mobile fallbacks. The connected-channel/chat test mocks the external connection display and Twitch iframe; it is not a new live Twitch broadcast test. The running localhost Vite endpoint was also checked and served the new LiveExperience integration.

Match closure tests fill all four owned slots, reject an additional room, reject non-owner and forged-origin closure, close an owner's room, verify worker disposal and spectator socket termination, and create a replacement without changing the four-room cap. Browser verification checks cancel/confirm, unavailable spectator state and close controls in the recent-match list. Typecheck, lint and build passed. Actual live-channel token revocation was not externally exercised in this follow-up.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:extension
pnpm exec playwright install chromium
pnpm test:e2e
pnpm evaluate
pnpm soak
pnpm audit --prod
```

Vitest builds and tests the actual worker. Coverage includes deterministic combat, ability bounds, malicious blueprints, 20 valid/30 adversarial concepts, voting, permissions, OAuth state/scopes, source attribution, duplicate events, rate limits, EventSub migration/recovery and read-only client sockets. Complete replay integration observes splitting, raid and victory, resets, then compares the entire game state exactly.

Playwright checks landing/mobile layouts, the Forge-to-deployment flow, pause/reset, clipboard, OBS and invalid operator access. Screenshots are in `docs/screenshots`; failure traces are ignored. Browser metrics record local command-to-proposal presentation and frame intervals.

Expanded-view tests cover laptop viewport fit, retained canvas and exact paused game state, labels, focus containment/return, native fullscreen entry/exit, browser-driven exit events, unsupported/denied fullscreen fallback, portrait/landscape fit, spectator permissions and transparent control-free OBS output.

The full browser suite now passes against one built server instance. Public asset requests no longer consume the protected API's 120-request/minute/IP budget; the earlier per-file server workaround is unnecessary. Do not disable the API limiter to pass tests. The production host-setup test expects the dedicated local key used in the verification instructions, never the owner's saved credentials.

`pnpm run profile:ui` measures local renderer and compact-snapshot work and writes `docs/evaluation/optimization.json`. Set PROFILE_BASE_URL to a running built instance to include its actual entry bundle size. Offscreen rendering and paused health-bar redraws are measured independently from the authoritative simulation. Emulated-device FPS and reconstructed legacy network bytes are local samples, not deployment or physical-device guarantees.

Evaluation uses fixture output, 200 battles per candidate and 1,000 duplicate events. The soak runs 120 two-minute matches: four accelerated simulation hours, not four real hours of browser/network uptime. It checks caps and finite values and records uncollected heap growth; this is not proof of absence of leaks.

CI runs the checks on Ubuntu/Node 24. Local checks ran on Windows/Node 24. Remote CI execution is not claimed until pushed and observed.

Synthetic tests do not establish real Twitch eligibility, provider billing, public hosting or actual stream interaction. Complete the live acceptance checklist before submission.
