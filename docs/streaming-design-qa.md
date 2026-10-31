# Streaming and castle-lane visual QA

Date: October 31, 2026.

## Target and evidence

The selected source is the user's attached 1672×941 PATCH WARS reference: navigation and scoreboard, dominant host video, right chat, lower-right soldier chooser and bottom castle battle. The source remains in the conversation; no local copy of that attachment was supplied. Its person/video frame and chat are illustrative content, not an available broadcast.

Implementation: `docs/screenshots/streaming-desktop.png` at 1672×941 CSS pixels, `streaming-mobile.png` at 390×844, `castle-lane-desktop.png` at 1920×1080 and `castle-lane-mobile.png`. `castle-motion.webm` records actual fixture movement, deployment, resize and pause. Captures use labeled simulation, not real video/chat. Prior Sunstone QA is archived in `docs/design/sunstone/qa-before-streaming.md`.

## Iterations

1. P2: inherited aspect ratio narrowed the battle to part of the video width. Fixed with explicit responsive width and independent strip height.
2. P2: grid sizing gave the canvas its intrinsic height and clipped soldiers below the strip. Fixed by positioning the canvas inside its bounds and deriving Pixi camera height from the measured viewport ratio. Units/effects share the fitted ground baseline. A browser assertion now requires the full canvas rectangle to fit inside the strip.
3. P2: adding Deploy changed a last-child selector and joined role/name on one line. Fixed with a named text wrapper. Broadcast start/empty-state controls move above the open soldier tray.
4. Revised captures show both castles and complete grounded soldier silhouettes. Chat retains scrolling/expansion. No fake streamer photograph, messages, viewer count or LIVE badge were introduced.

## Fidelity surfaces

- Typography: serif brand/team names, compact sans-serif controls and readable numeric timer; existing Phosphor icons.
- Layout: dark header, main-column scoreboard, large broadcast region, optional right chat, lower-right deployment tray, horizontal battle below; independently collapsible controls.
- Colors: near-black panels, ivory lettering, orange Ember, cyan Azure, restrained brass borders. Native chat ancestors remain opaque and unfiltered.
- Images: generated castle artwork and existing Sunstone human sprites/portraits. The measured camera preserves gates and full soldier bodies without stretching artwork.
- Content: actual health, costs, energy, phases and receipts. Demo labels remain visible. Sprinter retains its existing command/name instead of silently becoming Assassin.

## Intentional differences and acceptance limits

The source's illustrative host image and custom chat become official connected-channel Twitch video/chat frames. Their internal content/controls cannot be freely restyled. Invented costs and health totals become actual values. Panels initially collapse to preserve the requested icon toggles. Narrow player regions offer an external stream link. Native playback controls have space below the tray. Fixture matches show an honest video empty state.

Responsive composition and local runtime UI review pass. Pixel-identical source comparison is **not signed off**: the original raster is unavailable as a local combined comparison artifact, and the real broadcast state has not been supplied. Actual host video, authenticated native chat and public-host acceptance remain manual checks. No exact screenshot equality or completed live broadcasting is claimed.

final result: blocked — strict source-raster/live-state comparison remains pending; implementation and local interaction verification are recorded separately.
