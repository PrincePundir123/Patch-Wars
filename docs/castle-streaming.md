# Streaming and castle-lane experience

The `/play/:room` surface and expanded theater now place the host broadcast above a horizontal castle battle, with an optional right-hand chat and a toggled soldier tray. Operator controls, viewer identity, command authorization, energy and EventSub deduplication are shared with the existing app.

## Host setup

1. Start the app and create a live match from the control room.
2. Connect the broadcaster's Twitch channel using the existing OAuth flow.
3. Start streaming to that same channel from OBS. Connecting OAuth alone does not transmit video.
4. Open the match's play page and select **Watch broadcast**. Playback starts muted and requires native player interaction; Twitch displays the actual live/offline state.
5. Use the Chat and Choose a soldier icons to open those panels. Deploy uses shared team energy, not money or Bits. The existing `!spawn archer` command remains available in Twitch chat.

The official player uses `channel`, the current hostname as `parent`, `muted=true` and `autoplay=false`. The app never receives camera/microphone access. Only one player is mounted per live surface. If the panel is below Twitch's supported 400×300 size, use **Open stream** instead. Frame loading is not proof that a channel is live. Twitch owns offline/playback errors inside the cross-origin frame; the app provides a loading timeout and an external fallback.

Use the dedicated `/overlay/:room` browser source in OBS, plus your webcam and microphone sources. Do not capture the watch page back into its own Twitch broadcast: it includes Twitch playback and can create a recursive stream/audio loop. The overlay has no Twitch video or chat iframe.

Reference: [official Twitch video embeds](https://dev.twitch.tv/docs/embed/video-and-clips/), [chat embeds](https://dev.twitch.tv/docs/embed/chat/).

## Authoritative lane rules

- All units and split children occupy logical Y=270. Gates deploy at X=90 and X=1110; castle targets remain X=60 and X=1140.
- Simultaneous reinforcements queue behind the gate in bounded 20-unit offsets (maximum 80). Spawn order and target tie-breaks use deterministic entity IDs.
- Units march toward the closest living opponent, stop at their existing attack range, then continue toward the enemy castle when no opponent remains. Steps clamp at attack range.
- Friendly units are nonblocking. This deliberately allows faster melee units to pass stationary friendly archers, avoiding permanent gate congestion. Large armies can overlap; there are no invisible alternate combat lanes or client-only collision decisions.
- Existing 20 Hz rate, starter health/damage/range/speed/costs, attack cooldowns, slow, shield, heal, splash, split caps, endgame movement modifier and authorization remain in place.
- Lane concentration increased the Prism Slime fixture's mirrored win rate to 80%. Its health was reduced from 95 to 75, producing 60% wins over 200 equal-cost mirrored engagements. The 25–75% acceptance threshold is unchanged.
- Sprite gait, facing and event-driven combat effects use the existing Sunstone atlas. The new background is generated artwork; provenance is in `docs/design/castle-lane/README.md`.

## Verification boundaries

Automated tests use labeled demo rooms and mocked external video/chat frames. These verify integration parameters, layout, deployment, deterministic combat, pause/reset and OBS isolation, not an actual Twitch broadcast. A real host must start OBS broadcasting and verify video playback plus authenticated chat in their own browser before live streaming is considered accepted.
