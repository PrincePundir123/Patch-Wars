# UI redesign: implementation and verification

Completed October 29, 2026 (IST).

The detailed implementation brief is [ui-redesign-prompt.md](ui-redesign-prompt.md). The approved mockup pack supplied the screen hierarchy and fantasy identity; the owner explicitly requested a more natural, less generated-looking finish and unchanged functionality. The implementation therefore uses matte original unit artwork, quiet surfaces, restrained gold accents and real accessible controls rather than reproducing the mockups' glow, decorative borders or inaccurate sample copy.

## What changed

- Original landing, arena illustration, wordmark/icon treatment and command/vote/Forge explanation.
- Host setup composition and match-section navigation. Existing operator unlock, live/demo creation, channel connection, invitations and actions remain intact.
- Six original reusable unit illustrations across catalog cards, details, Forge and Pixi sprites. Team rings, positions, HP bars, effects, interpolation and highlights retain the existing game state.
- Catalog-driven unit search/filter and a native modal dialog with Escape dismissal, focus restoration, real stats, weaknesses, abilities and copyable Twitch commands.
- Forge hierarchy, readable blueprint card and collapsible low-level validated behavior. Pipeline stages, fixture labels, provider and actual balance data are preserved.
- Compact victory panel, actual elapsed match time after completion and closed-round labels. Stale command notices are hidden after results.
- Responsive controls/settings, mobile Forge ordering, clean spectator routes, transparent OBS page, consistent Phosphor icons and a matching favicon.

## Preservation boundary

Baseline commit: `2b5ea58adf9c02aa8a8d1cc8ced5674dc3840637`.

`git diff 2b5ea58 -- apps/server apps/forge-worker packages` is empty. There are no changes to simulation, unit stats, commands, voting, OAuth, ownership, permissions, APIs, providers, validation or worker execution. All new state is presentation state: unit filters/dialog and existing label/audio preferences. Existing routes remain unchanged. No real Twitch messages or paid AI requests were sent during redesign verification. The running tunnel server's local environment was not altered for tests.

## Checks

- 101 automated tests passed in 15 files, including exact replay equality, adversarial prompts, permissions, Twitch normalization and real worker fixture flow.
- Eight browser checks passed together on a clean isolated production instance at localhost:3002. Coverage: presentation/canvas bounds, desktop/mobile landing, full replay/Forge/split/OBS/controls, operator error, exact-unit feedback, labels/audio toggles, catalog search/dialog/copy/Escape/focus, settings round-trip, proposal rejection, command disabling, operator unlock, live room creation, required Twitch connection and invitation generation.
- Strict TypeScript, ESLint and production build passed.
- Browser screenshots were inspected on desktop and at 390px width; no horizontal overflow or captured application errors in the verified flows.
- One earlier combined run timed out on replay during concurrent capture. Its server match later completed; the isolated replay check and then the entire clean eight-test suite passed. Tests were not weakened to bypass it.
- A genuine completed replay result was captured via the read-only spectator route. No synthetic victory state was used. A separate browser-only snapshot sequence reused entity ID1 from an Ember guardian to an Azure archer; inspected before/after crops confirmed correct artwork replacement and facing with no browser errors. This transport mock was a focused renderer check, not a live Twitch test.
- Image assets total approximately 689 KB in WebP. System fonts avoid external font requests. The main frontend bundle remains above Vite's warning threshold; artwork and the added renderer functionality are not a guarantee of 60 FPS on every phone.

## Evidence

Screenshots in `docs/screenshots`: landing, mobile landing, dashboard, mobile dashboard, setup, results, mobile unit details and OBS overlay. The local side-by-side design comparison is under `.data/ui-design-review`. See root [design QA](../design-qa.md) for the visual review and deliberate reference differences.

The fixture replay, actual provider labels and original Codex evidence remain honest. Public hosting, a newly recorded Twitch-to-AI flow, second-channel acceptance and the Devpost submission remain separate external tasks.
