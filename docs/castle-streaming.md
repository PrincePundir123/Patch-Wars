# Streaming and castle-lane experience

The `/play/:room` surface and expanded theater now place the host broadcast above a horizontal castle battle, with an optional right-hand chat and a toggled soldier tray. Operator controls, viewer identity, command authorization, energy and EventSub deduplication are shared with the existing app.

The broadcast fills the available scene using a centered 16:9 cover crop and extends behind the castle lane. A dedicated transparent RGBA foreground (`castle-foreground-v2.png`) contains only the castles and stone fighting platform. It replaces the approximate polygon mask, removing sky patches between the towers and above the battlements. Soldiers and combat effects remain separate layers with their original positions. Panel borders and the gap between broadcast and lane are removed. Stream status and the external stream link sit above the existing label, sound, chat and soldier controls. Normal operator and OBS views retain their existing scenery. Black bars baked into the broadcaster's OBS output must be removed at the source.

The stream battlefield reserves transparent headroom based on its width so both towers, battlements and flag tips fit above the unchanged ground anchor. Its foreground outline follows the castle silhouettes rather than a rectangular cut across the towers. Desktop and laptop regression screenshots are saved as `docs/screenshots/complete-castles-1920.png` and `docs/screenshots/complete-castles-1366.png`; these show the labeled simulated replay, not a live broadcast.

Battle rendering now sizes its backing buffer to the displayed width and device pixel ratio, capped at 2x logical resolution on desktop and 1.5x on coarse-pointer devices. This avoids stretching a 1200-pixel render across a wider desktop viewport. Alpha regression tests inspect the actual asset's tower gaps and platform pixels, and screenshot fixtures use a contrasting colored video background (`transparent-castles-1920.png` and `transparent-castles-1366.png`). These fixtures are explicitly labeled and do not verify live Twitch playback.

## Host setup

1. Start the app and create a live match from the control room.
2. Connect the broadcaster's Twitch channel using the existing OAuth flow.
3. Start streaming to that same channel from OBS. Connecting OAuth alone does not transmit video.
4. Open the match's play page and select **Watch broadcast**. Playback starts muted and requires native player interaction; Twitch displays the actual live/offline state.
5. Use the Chat and Choose a soldier icons to open those panels. Free mode uses shared team energy and supports `!spawn archer` in Twitch chat. With [paid deployments](paid-deployments.md) enabled, viewers activate fixed soldier products in the native Twitch Extension; free chat deployment aliases are blocked for viewers, and authenticated broadcasters retain host controls.

The official player uses `channel`, the current hostname as `parent`, `muted=true` and `autoplay=false`. The app never receives camera/microphone access. Only one player is mounted per live surface. If the panel is below Twitch's supported 400×300 size, use **Open stream** instead. Frame loading is not proof that a channel is live. Twitch owns offline/playback errors inside the cross-origin frame; the app provides a loading timeout and an external fallback.

Use the dedicated `/overlay/:room` browser source in OBS, plus your webcam and microphone sources. Do not capture the watch page back into its own Twitch broadcast: it includes Twitch playback and can create a recursive stream/audio loop. The overlay has no Twitch video or chat iframe.

Reference: [official Twitch video embeds](https://dev.twitch.tv/docs/embed/video-and-clips/), [chat embeds](https://dev.twitch.tv/docs/embed/chat/).

## Authoritative lane rules

- All units and split children occupy logical Y=270. Gates deploy at X=90 and X=1110; castle targets remain X=60 and X=1140.
- Simultaneous reinforcements queue behind the gate in bounded 20-unit offsets (maximum 80). Spawn order and target tie-breaks use deterministic entity IDs. Castle artwork is fitted without horizontal cropping, and sprite/effect coordinates use the same lane projection in every view.
- Units march toward the closest living opponent, stop at their existing attack range, then continue toward the enemy castle when no opponent remains. Steps clamp at attack range.
- Friendly units are nonblocking. This deliberately allows faster melee units to pass stationary friendly archers, avoiding permanent gate congestion. Large armies can overlap; there are no invisible alternate combat lanes or client-only collision decisions.
- Existing 20 Hz rate, starter health/damage/range/speed/costs, attack cooldowns, slow, shield, heal, splash, split caps, endgame movement modifier and authorization remain in place.
- Lane concentration increased the Prism Slime fixture's mirrored win rate to 80%. Its health was reduced from 95 to 75. The final queued-spawn evaluation gives 56.5% wins over 200 equal-cost mirrored engagements. Frost Ranger fixture cost increased from 5 to 6 (60% wins); Aegis Guard fixture damage increased from 10 to 13 (40% wins). Bloom Medic remains unchanged (60%). Starter units and the 25–75% acceptance threshold are unchanged. These are fixture balance adjustments, not silent edits to live generated blueprints.
- Sprite gait, facing and event-driven combat effects use the existing Sunstone atlas. The new background is generated artwork; provenance is in `docs/design/castle-lane/README.md`.

## Verification boundaries

Automated tests use labeled demo rooms and mocked external video/chat frames. These verify integration parameters, layout, deployment, deterministic combat, pause/reset and OBS isolation, not an actual Twitch broadcast. A real host must start OBS broadcasting and verify video playback plus authenticated chat in their own browser before live streaming is considered accepted.

The merged-scene and transparent-artwork updates were checked with TypeScript, ESLint, a production build, nine deterministic/control/replay tests, and ten streaming/theater/animation browser tests covering desktop and mobile. The browser tests check real asset alpha, render pixel density, video coverage, foreground overlap, status placement, player retention, pause/reset and OBS isolation. Actual live Twitch playback remains an external acceptance check.
