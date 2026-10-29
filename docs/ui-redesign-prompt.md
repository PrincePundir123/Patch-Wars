# PATCH WARS: UI-only redesign implementation prompt

## Mission

Act as the senior product designer and frontend engineer for PATCH WARS. Implement a complete, coherent visual redesign using the approved ten-screen mockup pack at `.data/tft-design-pack/mockups`. Preserve the working project and all existing functionality. This is a production frontend refactor, not a new app, backend migration, screenshot website or gameplay rewrite.

The desired result is a credible independent game product: legible gameplay, original character identity, clear streamer controls, confident typography and a calm, professionally composed interface. Refine the reference art direction so it feels deliberately designed rather than uniformly glossy or mechanically generated.

## Authoritative sources and conflict resolution

1. Existing engine, schemas, handlers, permissions and documented runtime behavior are authoritative.
2. The user's UI-only constraint overrides inaccuracies in the generated mockups.
3. Use the mockups for hierarchy, visual identity, component relationships and composition. Reconcile every stat, class, ability, command and status against actual data.
4. Keep existing routes and actions. Do not add currency, purchases, ranks, persistent leaderboards, augments, taunts, ally shields, authentication providers or unsupported mechanics because they appear in an illustration.
5. Never embed a full screenshot as the functional interface. Use real DOM controls, live data, semantic text and independently reusable artwork.

## Immutable functionality

Do not modify apps/server, apps/forge-worker, packages/shared, packages/game-core, packages/twitch-adapter, backend endpoints, OAuth scopes/state, tokens, ownership, cookies, command parsing, voting semantics, deduplication, rate limits, simulation frequency/seed, unit stats, ability execution, AI provider configuration, worker limits, validation, balance gates or match lifecycle.

Preserve `/`, `/demo`, `/dashboard`, `/spectate/:id` and `/overlay/:id?transparent=1`. Preserve API request bodies, WebSocket handling and read-only spectators. Preserve real/demo labels and provider attribution.

All these controls must remain available: create replay/live match; operator unlock; existing room selection; Twitch connect/disconnect; second-broadcaster invitation; open channel chat; start/pause/resume/reset; demo command/team selection and presets; vote/Forge round controls; proposal rejection; team names/duration/commands/Forge settings; OBS copy and clipboard fallback; labels and audio; error dismissal and navigation.

## Visual direction

- Deep ink/navy page backgrounds; slightly lighter surfaces; warm ivory primary text; muted slate secondary text.
- Restrained antique gold for selected actions and identity. Orange and cyan always identify Ember and Azure. Violet identifies the Forge and AI state.
- Avoid blanket neon outlines, ornamental frames around every element, excessive gradients, repeated glow, floating marketing numbers, fake social proof and generic oversized dashboard statistic tiles.
- Use a consistent spacing scale (4, 8, 12, 16, 24, 32, 48, 64), modest radii and subtle borders.
- Strong readable display typography for headings; clean sans-serif interface text; monospace only for commands and technical identifiers. Self-host any added fonts; keep licensing.
- Use one maintained icon library consistently. Avoid unicode stand-ins or emoji for app controls.
- Use original restrained matte artwork. Keep UI separate from illustrations. No Riot logos, champions or downloaded third-party game art in production assets.
- Preserve the actual 2D coordinate space and responsive canvas aspect ratio. Art must not conceal collisions, health bars, targeting or team identity.

## Screen and component requirements

### Landing

Create an original brand wordmark, concise navigation, cinematic but restrained arena scene, clear value statement and two working actions: demo and Twitch control room. Explain command, vote and Forge in a short readable sequence. Introduce the real starter roster. Retain honest simulated-preview wording and existing landing preview behavior. Avoid fake testimonials, counts or claims.

### Setup and lobby

Present replay and live setup clearly. Show actual Twitch configuration status and operator unlock. Preserve every existing match and channel action. Connected channel name and direct chat link must be obvious. Distinguish optional Azure participation from required connection. Show real readiness based on current state and explain that localhost invitations are not reachable from another computer.

### Live arena

Make the battlefield the dominant surface. Keep both team names, health, score and timer readable above it. Preserve command feedback and exact-entity highlights. Introduce recognizable unit artwork with team rings and health bars; preserve renderer lifecycle, interpolation, reduced motion, entity limits and fallback errors. Do not change simulation positions or unit behavior. Separate spectator presentation from host controls.

### Voting

Use real proposal IDs, ideas, team attribution, votes and round timing. Present compact readable proposal cards, honest empty states and correct voting/proposal/processing labels. Commands remain Twitch commands; copy/inspect UI must not imply unauthorized direct voting.

### Forge

Show current provider and fixture/AI distinction, original idea, actual worker stages, attempt status, errors and measured balance results. Reveal actual blueprint data: shape, name, archetype, health, damage, cost, ability and weaknesses. Preserve the existing three-second live deployment countdown, pause behavior, capacity waiting and deployed unit command. Never present fixture output as generated AI.

### Unit roster and details

Use engine/catalog data for every stat, class, description and weakness. Reuse the same artwork across roster, detail, Forge and renderer. Add presentation-only browsing/filtering and a keyboard-accessible detail dialog if helpful. Include actual spawn commands with copy feedback. No new backend requests or game effects.

### Results

Present real winning team, score, elapsed simulation time, seed and forged-unit summary clearly. Keep reset/start behavior and existing links. Do not invent rewards, participation counts or new persisted history.

### Streamer settings

Group existing controls into readable panels: Twitch connections, match settings and broadcast/presentation. Preserve every field validation, button disabled state and submitted payload. Keep credentials out of screenshots and never expose local environment variables in frontend code.

### OBS and spectator

Retain read-only routes and transparent background. Keep the score, battle and Forge legible at 1920x1080. Do not include operator controls or navigation in OBS. Test both full-background spectator and transparent overlay.

### Mobile

Support 390px phones through large desktop without horizontal overflow. Collapse grids in meaningful order, keep buttons at least 44px where practical, allow commands/identifiers to wrap, and keep form labels visible. The small arena remains proportional; provide readable surrounding information instead of enlarging the canvas beyond the viewport. Dialogs must fit short screens and scroll safely.

### Shared states

Cover hover, focus, selected, disabled, loading, empty, success, warning, rejection, disconnected, reconnecting, lobby, paused and completed matches. Use real labels and status text, not color alone. Keep notifications bounded and avoid continuously announcing 20Hz snapshots to screen readers.

## Accessibility and implementation quality

Use semantic landmarks and headings, descriptive links, labelled forms and icon buttons, visible keyboard focus, accessible dialogs with focus restoration/Escape dismissal, adequate contrast and reduced-motion support. Keep interactions operable by keyboard. Decorative art has empty alt; meaningful portraits have concise alternatives. Do not create background audio or enable sound automatically.

Keep frontend modules understandable. Use derived presentation state without duplicating server state. Avoid remounting the Pixi app during snapshot updates. Load images efficiently, use reusable textures, clean up rendering resources, and retain CSP compatibility. Asset loading failure must leave a usable fallback.

## Working sequence and commits

1. Record this prompt, baseline functional inventory and preservation boundary.
2. Add design foundations and original reusable assets in a focused commit.
3. Implement landing/setup branding and layout in a focused commit.
4. Implement battle/Forge/roster/results rendering in a focused commit.
5. Finish mobile, settings, spectator/OBS and accessibility polish in a focused commit.
6. Record tests, screenshots and design QA in a final commit. Push only the completed coherent work to the existing repository.

Never stage `.env`, credentials, temporary files or downloaded TFT reference art. Preserve unrelated user changes.

## Verification and completion

Run strict typecheck, lint, full automated tests, build and meaningful browser regression coverage. Use an isolated local production verification port if needed so existing tunnel-origin settings are not weakened. Confirm routes, demo command -> receipt -> exact unit, Forge deployment/split, vote, pause/resume/reset, settings round-trip, proposal moderation, clipboard fallback, spectator/OBS and reconnect. Use mocked auth only for testing UI boundaries; never claim a fresh live Twitch authorization was verified without evidence.

Capture and inspect desktop, mobile, setup, unit details, Forge, results and OBS. Compare them to approved mockups and the user's requested natural refinement; explain deliberate differences. Check console errors, missing assets, overflow and controls obscured by art. Confirm backend/core files have zero diff against the baseline commit.

Write a design QA report with actual passed checks and material limits. Keep the app running. Final response must include preview URL, prompt/document location, commits, test results and any external verification still needed. Do not guarantee a hackathon win.
