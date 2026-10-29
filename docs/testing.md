# Testing

Current verification: **122 automated tests across 23 files** and **20 Chromium browser tests**. Coverage includes the eight existing flows, five expanded-view checks and seven loading/readiness/command/performance checks. Earlier evidence remains in [Field Studio verification](field-studio-verification.md); the latest changes are described in [priority improvements](priority-improvements.md). Follow the [manual rehearsal](manual-rehearsal.md) for demo and actual Twitch/OBS checks.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm evaluate
pnpm soak
pnpm audit --prod
```

Vitest builds and tests the actual worker. Coverage includes deterministic combat, ability bounds, malicious blueprints, 20 valid/30 adversarial concepts, voting, permissions, OAuth state/scopes, source attribution, duplicate events, rate limits, EventSub migration/recovery and read-only client sockets. Complete replay integration observes splitting, raid and victory, resets, then compares the entire game state exactly.

Playwright checks landing/mobile layouts, the Forge-to-deployment flow, pause/reset, clipboard, OBS and invalid operator access. Screenshots are in `docs/screenshots`; failure traces are ignored. Browser metrics record local command-to-proposal presentation and frame intervals.

Expanded-view tests cover laptop viewport fit, retained canvas and exact paused game state, labels, focus containment/return, native fullscreen entry/exit, browser-driven exit events, unsupported/denied fullscreen fallback, portrait/landscape fit, spectator permissions and transparent control-free OBS output.

The full 20-test browser suite now passes against one built server instance. Public asset requests no longer consume the protected API's 120-request/minute/IP budget; the earlier per-file server workaround is unnecessary. Do not disable the API limiter to pass tests. The production host-setup test expects the dedicated local key used in the verification instructions, never the owner's saved credentials.

`pnpm run profile:ui` measures local renderer and compact-snapshot work and writes `docs/evaluation/optimization.json`. Set PROFILE_BASE_URL to a running built instance to include its actual entry bundle size. Offscreen rendering and paused health-bar redraws are measured independently from the authoritative simulation. Emulated-device FPS and reconstructed legacy network bytes are local samples, not deployment or physical-device guarantees.

Evaluation uses fixture output, 200 battles per candidate and 1,000 duplicate events. The soak runs 120 two-minute matches: four accelerated simulation hours, not four real hours of browser/network uptime. It checks caps and finite values and records uncollected heap growth; this is not proof of absence of leaks.

CI runs the checks on Ubuntu/Node 24. Local checks ran on Windows/Node 24. Remote CI execution is not claimed until pushed and observed.

Synthetic tests do not establish real Twitch eligibility, provider billing, public hosting or actual stream interaction. Complete the live acceptance checklist before submission.
