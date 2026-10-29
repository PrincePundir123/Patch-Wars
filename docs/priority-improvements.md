# Prioritized reliability and usability improvements

Baseline: 3a0f7aa. Scope: requested priorities 1–5. Persistent match summaries (priority 6) are excluded.

## 1. Public assets and protected API requests

The production rate limiter now exempts only the matched GET/HEAD public-file/SPA wildcard route. Explicit API, authentication, health and WebSocket routes retain the existing 120 requests per minute per IP policy. No forwarded-IP header is trusted. Query strings that look like asset URLs cannot bypass API limits.

Content-hashed JavaScript/CSS assets use a one-year immutable cache policy. HTML revalidates; unversioned artwork has a short revalidating policy. Missing assets return JSON 404s instead of HTML masquerading as JavaScript. API responses retain no-store.

Verification: 130 asset requests succeeded without exhausting the API budget; the first 120 API requests succeeded and subsequent API/auth requests returned 429. Assets remained available after API exhaustion. Cache and missing-file headers were checked in an isolated temporary web root. Existing origin and ownership tests passed.

## 2. Initial loading and renderer recovery

The DOM-only unit portrait no longer imports Pixi. The renderer loads asynchronously, and the landing preview waits until it approaches the viewport. Vite runtime helpers are kept separate so they cannot accidentally preload the heavy Pixi chunk. A failed renderer download offers a manual reload that retains the current room URL rather than creating a new match.

Production frontend builds now explicitly use React's production runtime even when the local development .env says NODE_ENV=development. The local .env and runtime server checks are unchanged. Starter definitions were moved verbatim to a type-only catalog module; the engine retains its existing exports, values and algorithms.

At this milestone the initial JS entry was about 365 KB plus a 1.25 KB runtime, versus 1,070,750 bytes before this work (about 66% less minified entry code). The roughly 571 KB Pixi chunk is deferred and still legitimately triggers Vite's size warning. Gzip figures are build estimates, not a claim of deployed transfer sizes. The landing browser test also asserts that no Pixi asset is requested before the preview is approached. Engine and complete deterministic replay tests passed after the catalog move.

## 3. Presentation readiness

Each owned match has a collapsible Presentation readiness panel. It combines current socket/snapshot freshness and renderer initialization with on-demand ownership, origin, Twitch and provider checks. Ollama checks only its local model list with a 1.5-second timeout, five-second cache and per-provider request coalescing. Cloud checks inspect key configuration without sending a billed request. Reports contain no secrets and explicitly distinguish fixtures/configuration from live acceptance.

The API requires room ownership. Spectators cannot request private diagnostics. A browser test paused a real demo, ran the panel checks and compared the complete game state before/after; it remained unchanged. Tests also cover origin warnings, local-only provider endpoints, missing models, coalescing and secret-safe output. No persistent history or summary storage was introduced.

## 4. Rendering and snapshot work

The 20 Hz authoritative simulation is unchanged. Browser sockets opt into compact snapshots: a full catalog is sent on connection, catalog changes and reset; ordinary updates omit only that repeated catalog. A decoder restores the exact public Snapshot shape. Legacy sockets and HTTP snapshots remain full. Catalog references stay stable so the memoized unit library avoids unrelated game-tick rerenders.

Rendering now stops for hidden/offscreen canvases and resumes against the latest authoritative state. Desktop rendering targets at most 60 FPS; coarse-pointer devices target 30 with a 1.5 resolution cap; reduced-motion rendering targets 20. These are budgets, not achieved-frame-rate promises. Interpolation is time-based, unchanged health/status graphics are cached and identical event graphics are not rebuilt every display frame. DOM profiling counters update at most once a second and when activity changes.

`pnpm run profile:ui` profiles local fixture rooms in Chromium laptop and phone emulation, measuring renderer work, paused-bar redraws, offscreen suspension and actual compact bytes versus reconstructed legacy bytes. It writes docs/evaluation/optimization.json. It does not create saved match summaries, send Twitch commands or start paid generation.

## 5. Viewer command reference

How to play is available from the landing page, setup/dashboard and spectator page. Its native modal dialog documents all nine parser-supported commands with copy buttons, clear attack/defend behavior, proposal/vote rules, energy and cooldown guidance. Connected-channel chat links are included when available. The guide never sends a command or starts generation; clipboard denial falls back to readable instructions. Escape closes the dialog and restores focus. OBS remains control-free.

Tests pass each documented example through the real parser and verify attack/defend unit behavior. Browser checks compare paused match state before/after copying, inspect phone fit and focus return, and simulate clipboard denial.

## Final verification and command clarity

Typecheck, lint, build, all 122 automated tests across 23 files and all 20 Chromium browser tests passed after the final changes. The full browser suite used one built server instance. Updated screenshots are in docs/screenshots. The large deferred Pixi chunk and upstream Zod annotation warnings remain nonfatal build warnings.

The final entry is 377,439 bytes (116,346 gzip estimate), about 65% below the 1,070,750-byte baseline. The final isolated built-server profile saved about 39.7% of snapshot bytes in both local samples, with zero offscreen frames and zero unchanged health-bar redraws during the paused sample. Observed renderer rates were about 26.3 FPS at the laptop viewport and 11.9 FPS in phone emulation; these do not establish physical-device performance or a 60 FPS guarantee. See docs/evaluation/optimization.json. An initial profiling attempt after the complete browser suite timed out; profiling succeeded on a fresh isolated server with the normal API limiter retained.

Following feedback that commands and Twitch were confusing, demo sends now show their result beside the form and link back to the battlefield. Command-copy instructions distinguish demo replay input from actual Twitch chat. Live matches show a visible next action and the latest command receipt. No command grammar, gameplay rules or authorization boundary changed.

The selected live experience is Twitch chat controlling a battle captured in OBS. A native Twitch extension and Bits purchases from the PixelWars reference are not implemented or required for that experience. The [manual rehearsal](manual-rehearsal.md) separates fixture simulation, actual Twitch authorization/chat, OBS broadcasting and real local AI. Live broadcasting, remote second-channel consent and hackathon submission still require owner participation; this automated run does not claim them complete.
