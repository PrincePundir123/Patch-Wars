# Sunstone Battleground

The owner's selected Sunstone concept replaces the floating-island/animal art with a warm limestone courtyard and five human soldier classes. This is an implementation of its visual direction within the existing PATCH WARS game, rather than a new game engine or a screenshot placed over the battlefield. The concept's animation-study strip is design documentation, not part of the live UI. Scores, team names, health, timers and costs continue to display actual match state.

## Presentation

- The Guardian, Archer, Sprinter, Healer and Bomber have distinct silhouettes and coordinated orange/teal outfits. Generated units retain the six supported appearance shapes, including the splitting slime.
- Each role has six poses for each team: idle, two walk strides, wind-up, contact and recovery. Explicit texture frames and uniform origins/trims align feet across pose changes. Walk cycles follow rendered distance rather than a shared wall-clock bob; attack poses follow acknowledged attack counts and cooldowns. Units turn toward movement/targets and are drawn back to front by ground position.
- Shared projection maps the authoritative world into the walkable court. A portrait camera presents the entire fight in a taller frame; switching viewport or chat layout preserves the same canvas and match. Rematches discard the previous round's gait/attack state even when entity IDs are reused. Contact shadows and restrained depth scaling keep units grounded.
- Arrows, short melee sparks, arcing bombs, healing pulses and spawn/split rings use confirmed battle events. Effects are bounded to the latest 36 events and expire after ten simulation ticks. They do not predict damage or execute commands. Reduced motion uses stable idle poses and suppresses optional combat particles.
- The artwork also appears in landing previews, loading fallbacks, the searchable roster and extension portrait controls. Chat still uses only the official Twitch composer; the no-filter chat panel and icon toggle protections are preserved.

## Gameplay boundaries

No game-core, server, Twitch adapter, command schema, damage, hit range, move speed, energy, cooldown, voting, Forge validation or permissions changed. The Sprinter remains faster because its existing move speed is 2.6; Guardian remains 0.8, Archer/Healer 1 and Bomber 1.2. Walking and wind-up are visual interpretations of that same simulation. Pausing settles interpolation, then freezes pose progress while the authoritative game remains unchanged. OBS stays read-only and supports a transparent background.

## Assets and limitations

The source reference and generated PNGs are in `docs/design/sunstone`; deliverable WebP artwork is in `apps/web/public/art`. The animation atlas uses real alpha transparency and explicit per-frame rectangles in `apps/web/src/art/sunstone-units.json`. Do not slice it as a uniform grid. WebP copies preserve pixel dimensions and reduce the three artwork downloads from about 7.7 MB to 1.8 MB. System Georgia and sans-serif fonts, plus existing Phosphor icons, avoid external font services.

The result uses 2D sprite pose animation in Pixi, not a skeletal 3D model system. Some source attack frames have small sword/arrow-tip cuts. Generated units select one of the supported visual roles; the Forge does not generate a new animated character mesh. Those constraints do not change their validated abilities.

## Verification

Unit checks cover court projection, portrait framing, distance-based gait, attack/recovery selection, reduced motion, bounded depth scaling and all 72 atlas rectangles/anchors. Browser verification exercises real deployment, changing sprite poses, responsive camera switching, pause with unchanged authoritative game state and browser console errors. A recorded fixture replay shows actual runtime motion; it is not a real Twitch broadcast. Screenshots and the recording are in `docs/screenshots/sunstone-*`; the final visual comparison and results are recorded in `design-qa.md`.
