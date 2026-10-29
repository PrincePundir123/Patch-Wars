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
