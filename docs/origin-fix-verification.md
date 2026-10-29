# Operator-origin repair verification

Verified October 29, 2026, on the local Windows workspace.

## Problem and repair

The local configuration used a development tunnel as WEB_ORIGIN. The server previously accepted only that origin, rejecting localhost operator unlock and browser sockets. Development now permits the canonical configured origin, http://localhost:5173 and http://127.0.0.1:5173 through the same exact allowlist. Production permits only WEB_ORIGIN. Arbitrary domains, local ports and missing mutation origins remain rejected. Operator authentication and room ownership are still required.

Twitch links carry an explicitly allowed browser origin. The selected callback is saved with one-use OAuth state and reused for token exchange. This keeps the browser session on its initiating address. Legacy authorization links retain their configured callback, and broadcaster invitations use the canonical origin. Register each callback in the Twitch developer console; server acceptance does not register it with Twitch.

## Checks completed

- `pnpm test`: 114 tests passed across 18 files, including actual HTTP and WebSocket allowlist tests, production alias rejection, mocked OAuth exchange and one-use state replay rejection.
- `pnpm typecheck` and `pnpm lint`: passed.
- `pnpm build`: passed. Existing nonfatal bundle-size and dependency annotation warnings remain.
- `PLAYWRIGHT_BASE_URL=http://localhost:3002 pnpm test:e2e`: all eight Chromium tests passed against the production bundle served by an isolated local instance, using a dedicated test operator key. Covers mobile, fixture Forge deployment, OBS, settings, moderation and host setup.
- Actual development dashboard: a private browser check read the saved key locally, unlocked the control room, created a live match and confirmed CONNECTED snapshots with no page errors. It checked the Twitch authorization redirect without following it; the selected callback was http://localhost:5173/auth/twitch/callback. The key, OAuth state and room link were not recorded.
- `pnpm run doctor`: all nine checks passed for the current local configuration. No generation request or paid API call was made. Credentials were not printed.

Browser screenshots and browser measurements were refreshed by the browser suite. Local .env remains untracked and was not changed by this repair.

## What still requires external verification

This repair does not claim a new real Twitch consent flow, a full live Twitch-to-AI recording, second-channel Shared Chat/raid testing, public deployment or a submitted hackathon entry. Follow [readiness](readiness.md) for these remaining steps. Tokens and rooms remain memory-only; restart requires a new match and Twitch authorization.
