# Sunstone visual and interaction QA

Date: October 30, 2026.

## Evidence and state

- Source visual truth: `docs/design/sunstone/selected-reference.png`, 1672 × 941 pixels.
- Browser implementation: `docs/screenshots/sunstone-desktop.png`, 1920 × 1080 pixels, 1920 × 1080 CSS viewport, device scale factor 1.
- Phone implementation: `docs/screenshots/sunstone-mobile.png`, 390 × 844 pixels/CSS pixels, device scale factor 1.
- Full-view and focused comparison input: `docs/screenshots/sunstone-comparison.png`. Opened and reviewed with both reference and implementation in the same image. The second row compares soldier silhouettes, material treatment, team colors and ground contact at a larger scale.
- Runtime recording: `docs/screenshots/sunstone-motion.webm`, captured from the actual browser fixture replay, including deployment, active pose changes, viewport switching and pause.
- The source is an illustrative battle concept with a lower animation-study strip. The implementation is a running fixture match with real scores/timer/health and retained deployment/account controls. Numerical match values and exact combat poses differ intentionally. The study strip is excluded from the product UI. This review assesses the chosen art direction and working product rather than claiming pixel-identical combat state or 3D rendering.

## Comparison history

1. Initial implementation capture: **blocked**. P2: a wide camera made portrait soldiers too small and the CSS background repeated beyond the fitted canvas. Fixed by introducing a portrait projection, fitting the background inside the renderer and using a solid forest surround. The same canvas and authoritative state survive camera changes.
2. Revised desktop/mobile captures: the repeated background is gone and the portrait view has larger readable unit silhouettes. Desktop HUD was narrowed to a centered maximum of 880 pixels to give the battlefield more visual space. P2 fixes are verified in the final screenshots and combined comparison. The initial pause assertion also sampled the diagnostic counter before its periodic flush; the check now waits for the bounded interpolation/diagnostic window to settle, then requires unchanged poses and exact authoritative state equality.

## Required fidelity surfaces

| Surface                          | Review result                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts and typography             | Georgia display lettering and existing Arial/system interface text preserve the reference's serif/compact sans-serif hierarchy. Team names, timer, energy, cost and unit labels remain legible. Long real team/channel names keep existing wrapping behavior. No external fonts or text baked into the arena.                                                 |
| Spacing and layout               | Warm open courtyard, opposing teams, centered compact scoreboard, bottom-left soldier tray and separate right icon rail match the concept's hierarchy. Account/rematch controls and real base-health bars intentionally remain. Portrait camera and tray fit without horizontal overflow; chat is independently toggleable.                                   |
| Colors and tokens                | Ivory/sandstone scene, evergreen `#14251e` chrome, warm ivory text and brass accents follow the selected direction. Existing orange/cyan team semantics remain consistent across bars, outfits, rings and events. Official chat stays unfiltered and opaque.                                                                                                  |
| Image quality and asset fidelity | The arena, five human roles, slime and portraits are original generated raster assets based on the selected concept. Human poses replace the prior animal stickers. Alpha, explicit frame rectangles and common foot anchors were checked. WebP files preserve dimensions and reduce network weight. No placeholder/CSS-drawn characters replace the artwork. |
| Copy and app content             | Actual unit names, costs 5/4/3/4/5, team energy, match timer, health, command receipts and simulated-replay labels remain. No paid coins, invented upgrades, fake chat, concept-board labels or animation-study UI were added.                                                                                                                                |

## Interaction and regression verification

- Typecheck, lint, web/server production build and extension build passed.
- All **138 unit/integration tests across 29 files** passed, including projection, distance-based gait, reduced motion, depth bounds and every one of the 72 frame rectangles/anchors.
- All **28 Chromium browser cases passed** on the final fresh isolated built server in 4.1 minutes. This includes real fixture deployment and pose progression, portrait camera switching with a retained canvas, pause with exact game equality, clearing animation state on rematch while retaining the canvas, Forge, roster filters/details, OBS, fullscreen/fallbacks, renderer recovery, offscreen suspension, reduced motion and permission boundaries.
- The existing cross-origin chat visibility regression passed in desktop/phone/theater contexts. External Twitch iframe contents and native extension authorization are mocked where noted in those tests. No new real Twitch send, consent, Hosted Test acceptance or live broadcast is claimed.
- The Sunstone browser case captured no page errors. The local frame sample recorded a mean interval of about 16.8 ms; this is one automated Chromium sample, not a guarantee for physical phones or all GPUs.
- No files changed in game-core, server, shared contracts or Twitch adapter. The development server and its real Twitch room were not restarted.

## Remaining polish

- P3: the generated atlas contains small weapon-tip cuts in a few touching Guardian/Archer attack cells. Contact and damage remain correct. An artist-authored sprite pass could remove those minor edge limitations.
- This is six-pose-per-team 2D sprite animation, not skeletal 3D animation. Generated Forge units use the supported appearance roles. The recorded fixture replay verifies the shipped presentation; real device and live streaming checks remain separate acceptance steps.

## Implementation checklist

- [x] Selected reference and generated sources retained.
- [x] Browser delivery art encoded with alpha and unchanged dimensions.
- [x] Team-specific motion poses, target facing, depth, shadows and bounded event effects integrated.
- [x] Portrait framing and pause behavior verified without simulation changes.
- [x] Existing gameplay and chat protections retained.
- [x] Same-input full-view and focused visual comparison reviewed after fixes.
- [x] Automated checks, screenshots and runtime recording saved.

final result: passed
