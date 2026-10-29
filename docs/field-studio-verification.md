# Field Studio implementation and verification

October 29, 2026. Approved reference: [visual prototype](design/field-studio-prototype.png).

## Delivered

The ivory-and-forest visual system now covers the landing page, setup, operator dashboard, searchable roster, unit dialog, voting, Forge lifecycle, match settings, spectator page and OBS presentation. Desktop uses a persistent sidebar; smaller viewports use a compact top navigation. Configuration details are available through a native disclosure rather than dominating the connection panel.

Theater view fills the browser viewport. Fullscreen uses the standard browser API and synchronizes with fullscreenchange events, including browser-driven exits. Unsupported or rejected requests fall back to theater with an explanation. Expansion preserves the existing mounted canvas, audio controls, labels and live snapshot subscription. It does not issue game-control requests. The entire logical 1200-by-560 field is contained without stretching; different screen proportions have dark space around the field.

Expanded viewing traps keyboard focus, makes surrounding UI inert, restores prior inert/scroll state and returns focus when closed. Escape exits theater; native fullscreen retains browser-provided exit behavior. Provider and fixture labels stay visible. Spectator permissions and control-free transparent OBS remain intact.

## Preservation evidence

The pre-redesign baseline is 66472f2. `git diff 66472f2 -- apps/server apps/forge-worker packages pnpm-lock.yaml` is empty. No backend, engine, Twitch adapter, Forge provider, shared contract or dependency-lock changes were needed. Existing route and API handlers remain in use. No credentials or environment configuration were changed.

The new theater browser test compares the exact paused server game state before and after changing view, checks that the same canvas DOM element remains mounted, and confirms labels remain selected. Existing tests exercise actual settings, proposal moderation, reset/start, pause/resume, chat receipts, fixture Forge deployment/splitting, operator unlocking and invitation boundaries.

## Checks

- `pnpm test`: 114 tests passed across 18 files.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: passed.
- Production-bundle browser acceptance: all eight existing-flow tests passed (1.3 minutes) and all five expanded-view tests passed (25.7 seconds), on separate fresh instances. See the accompanying QA report for visual evidence and accepted differences.
- `pnpm run doctor`: all nine local configuration checks passed; no paid generation request was made.
- Actual development dashboard: saved local operator key unlocked successfully without being logged or captured; live room created; callback disclosure showed the correct localhost callback; native fullscreen opened and closed; mobile unit details worked; no page errors were captured. No new Twitch authorization was performed.
- Results-screen review: a real 60-second fixture match with Community Forge disabled in its disposable test room completed with an Ember victory. Desktop and phone result cards were inspected, with no phone overflow or page errors. This checks the actual result presentation; the separate acceptance suite checks Forge deployment.

Production-bundle tests used isolated localhost:3002 instances with NODE_ENV=development so local HTTP cookies could be exercised. This is a production-bundle test, not an HTTPS production deployment. The host test used a dedicated fake local key, not the saved operator secret.

## Reproducing production-bundle browser checks

Build first, start a fresh local instance with PORT=3002, HOST=127.0.0.1, WEB_ORIGIN=http://localhost:3002, NODE_ENV=development and ADMIN_KEY=ui-redesign-verification-key-local-only. Keep these as temporary process environment variables; do not replace the owner's .env.

Set PLAYWRIGHT_BASE_URL=http://localhost:3002 and run `pnpm exec playwright test tests/e2e/app.spec.ts`. Restart only this isolated test server, then run `pnpm exec playwright test tests/e2e/display.spec.ts`.

One combined cold-browser production run hit the existing 120-request/minute/IP limiter during the later tests. The trace showed 429 responses for a Pixi JavaScript chunk and artwork, followed by a renderer load failure. The remaining production tests passed on a fresh isolated instance. The request limit was not changed or disabled. Default development verification serves Vite assets separately. Do not mistake asset-load throttling for a fullscreen permission failure.

## Visual evidence

- [Live setup](screenshots/studio-live.png), [laptop fullscreen](screenshots/studio-fullscreen.png), [theater replay](screenshots/studio-theater.png).
- [Phone layout](screenshots/studio-mobile.png), [phone unit details](screenshots/studio-unit-details.png), [landing page](screenshots/studio-landing.png).
- [Completed match](screenshots/results.png), [phone result card](screenshots/studio-mobile-results.png).
- The existing browser suite refreshes dashboard, setup, mobile, unit-dialog and OBS captures too.

Source and implementation were inspected together in ignored .data/field-studio-comparison.png. The source uses illustrative connected-channel combat values; actual captures use real lobby or fixture replay snapshots. Values and provider/connection states are never hardcoded to imitate the mockup.

## Limits and remaining hackathon steps

Native fullscreen support depends on browser/device permissions. Tests used Chromium, including phone/tablet viewport emulation; physical iOS/Android device acceptance remains unverified. The existing Pixi/application bundle-size warning remains nonfatal. No universal frame-rate, complete accessibility compliance or hackathon result is guaranteed.

The implementation and local checks do not substitute for recording a real Twitch-to-AI flow, second-channel Shared Chat/raid acceptance, public HTTPS/WSS hosting, an authentic public demo video or confirming hackathon submission. Those tasks remain listed in [readiness](readiness.md).
