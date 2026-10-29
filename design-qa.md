# PATCH WARS UI design QA

Date: October 29, 2026 (IST)

final result: passed

## Scope and approved target

The ten-sheet mockup pack at `.data/tft-design-pack/mockups` is the source direction. The owner's subsequent instruction explicitly requires a more natural, less generated-looking finish, unchanged functionality and correction of inaccurate mockup content. This is an adapted implementation review against that brief, not a claim of pixel-identical reconstruction of generated screenshots.

Source and implementation were opened together in `.data/ui-design-review/landing-comparison.png` and `battle-comparison.png`. Source mockups are1487x1058; implementation captures use1440x1024 CSS pixels at deviceScaleFactor1. Both have approximately the same aspect ratio and are shown in adjacent equal-width panels. The battle reference shows sample live voting; the implementation shows the genuine paused fixture deployment state, so sample scores, units, timing and stage labels are not compared pixel by pixel.

Additional inspected evidence: docs/screenshots/setup.png, results.png, mobile-unit-details.png, mobile-dashboard.png and overlay.png. Desktop captures use1440x1024 (the standard browser suite uses1280x720); phone captures use390x844; OBS uses1920x1080. Full-page captures include content below the viewport. Mobile source images contain device frames while the implementation is a responsive website; no fake phone chrome is reproduced.

## Required visual surfaces

- Typography: coherent system sans-serif controls and Georgia display headings; no remote font dependency. Commands use monospace. Explicit sizes and spacing are readable at actual viewport scale. The heavily styled promotional wordmark is deliberately replaced by a restrained wordmark and consistent library icon.
- Layout rhythm: consistent borders/radii/spacing, dominant battle canvas, compact Forge side panel, grouped host controls and catalogue. On phones, battle/voting/Forge precede the longer unit library. No measured horizontal overflow in the inspected phone flows.
- Colors: ink/navy surfaces, ivory text, restrained gold selection, actual orange/cyan team identity and violet Forge. Whole-page glow and repeated decorative frames are deliberately reduced.
- Imagery: original matte atlas with distinct badger/fox/hare/moth/raccoon/slime silhouettes. Six512px cells are reused in DOM and Pixi. Team rings and real HP bars remain visible. Scene art is compressed WebP; the renderer retains geometric fallbacks. Production includes no Riot reference art.
- Copy/content: stats, archetypes, abilities, costs, weakness text and generated unit commands come from actual catalog/blueprint data. No sample vote totals, unsupported guardian powers, augments, purchases or fabricated player counts are shipped. Fixture and provider labels remain visible.

## Findings fixed and rechecked

1. P1: Default asset loading tried to create a blob worker rejected by the existing CSP. Replaced it with cached same-origin image loading; subsequent production browser checks captured no CSP or application errors. No server-policy changes.
2. P2: Results inherited an oversized left-aligned overlay. Centered and bounded the card, exposed the arena around it, displayed elapsed match time, closed completed voting labels and suppressed stale receipt banners after results. Genuine completed-match screenshot rechecked.
3. P2: Detailed behavior and readable Forge cards repeated information. Kept low-level behavior in an accessible expandable section while retaining readable ability/counterplay cards and actual metrics. The browser check opens and verifies this section.
4. P2: Mobile initially placed the roster ahead of the Forge. Responsive ordering now puts Forge before the roster; inspected visually and asserted by element positions.
5. P2: HTML root background could remain opaque for transparent OBS. Explicitly clear root and body for that route. A focused check measured rgba(0, 0, 0, 0), captured with background omitted and confirmed no host controls.
6. P2: Compact OBS unit art overlapped its deployment label. Reduced the portrait footprint and added spacing in the final overlay.
7. P2: Reused IDs could retain stale artwork after reset. Renderer now invalidates appearance changes; explicit blueprint palettes remain honored and Azure sprites face their opponents.

## Functional/accessibility evidence

101 automated tests passed. Eight browser checks passed together on a clean isolated production server, including actual reset/start, pause/resume, Forge/split, settings, proposal moderation, commands disabling, operator gating and invitations. Unit dialogs support keyboard Escape, native modal focus behavior and focus return; unit search/filter/copy and mobile fit were checked. Label and sound toggles retain their behavior; sound remains opt-in. Focus outlines and reduced motion remain available.

Backend/core preservation check: `git diff 2b5ea58 -- apps/server apps/forge-worker packages` is empty.

## Remaining P3 / external limits

The existing large combined Pixi/application chunk still triggers Vite's size warning. One measured browser frame sample is not a 60 FPS guarantee. New raster assets are generated artwork with deliberately restrained direction, not a claim of commissioned human painting. A fresh real-account Twitch/Shared Chat/raid acceptance run, public deployment and video/submission remain external work. No actionable P0/P1/P2 UI issue remains from this review.
