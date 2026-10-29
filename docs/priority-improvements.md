# Prioritized reliability and usability improvements

Baseline: 3a0f7aa. Scope: requested priorities 1–5. Persistent match summaries (priority 6) are excluded.

## 1. Public assets and protected API requests

The production rate limiter now exempts only the matched GET/HEAD public-file/SPA wildcard route. Explicit API, authentication, health and WebSocket routes retain the existing 120 requests per minute per IP policy. No forwarded-IP header is trusted. Query strings that look like asset URLs cannot bypass API limits.

Content-hashed JavaScript/CSS assets use a one-year immutable cache policy. HTML revalidates; unversioned artwork has a short revalidating policy. Missing assets return JSON 404s instead of HTML masquerading as JavaScript. API responses retain no-store.

Verification: 130 asset requests succeeded without exhausting the API budget; the first 120 API requests succeeded and subsequent API/auth requests returned 429. Assets remained available after API exhaustion. Cache and missing-file headers were checked in an isolated temporary web root. Existing origin and ownership tests passed.
