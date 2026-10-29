# Check PATCH WARS yourself

PATCH WARS is a browser-based game, not an extension. The local demo uses simulated chat and predefined Forge output. A live match listens to an authorized Twitch channel through EventSub and uses the configured Forge provider.

## 1. Open the running app

Open http://localhost:5173. If it is not running, open PowerShell in the project folder and run `pnpm.cmd dev`. Keep that terminal open. If port 5173 is already busy, try the existing page before launching another server.

Optional local setup check: `pnpm.cmd run doctor`. It never prints your key or makes a paid generation request.

## 2. Watch the complete automatic rehearsal

Open http://localhost:5173/demo. Keep this room URL; revisiting /demo without a room creates a new match. Reset restarts the same room.

| What to watch              | Expected result                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Connection and battlefield | CONNECTED, moving units, changing timer and team information                       |
| Community blueprints       | Scripted proposals appear and voting opens                                         |
| Forge                      | Blueprint generation, validation, 200 balance engagements, approval and deployment |
| Unit deployed              | Prism Slime appears; the roster gains its detail card                              |
| Combat                     | Eliminations and base health reflect the battle; a simulated raid occurs           |
| Finish                     | A result card and winner/draw appear; Reset becomes available                      |

The replay lasts 90 seconds of simulation time. Pauses and waiting for the worker can make wall time longer. Use the actual Forge/phase labels to judge progress. Everything here remains labelled SIMULATED REPLAY / FIXTURE FORGE, even if your live provider is Ollama.

## 3. Try controls and messages

1. Turn Unit labels on.
2. While the replay is running, find Replay controls under Stream controls. Choose Ember, enter `!spawn archer`, and press Send. Expect an Archer deployed receipt and a highlighted unit. Leave at least two seconds between messages.
3. Press Pause, then try another spawn. Expect a message explaining that combat is paused. Resume to continue.
4. Open How to play. Copy an example and paste it into a text editor. Copying must not send a game command. Escape closes the guide and restores focus.
5. Open Presentation readiness and select Check setup. Connection and renderer checks should pass. Demo/fixture notes are expected; they do not claim Twitch or real AI acceptance.
6. Try Theater view, Escape, Fullscreen and its visible exit. If the browser rejects native fullscreen, an explained theater fallback should open. The same match continues.
7. Open Spectator view in another tab. It should follow the same match and offer no operator pause/reset controls. Open the copied OBS link too; it should show no interactive viewing/host controls.
8. After the result, Reset and Start battle. Timer, base health, scores and the match-specific generated roster should reset.

## 4. Check Twitch itself

1. Open /dashboard and enter your saved operator key locally. Do not share it.
2. Create a Twitch match. Open Connection setup details and register the displayed callback in your Twitch developer app if needed.
3. Click Connect Ember with Twitch and authorize your channel. Stay on the same browser address throughout authorization.
4. Once connected, Start battle. Use the channel's Open chat link and send `!spawn archer` in actual Twitch chat.
5. Expect a TWITCH CHAT receipt and an Archer on that channel's team. The local replay's Send button is a separate simulation path.

A connected socket alone does not prove chat delivery. Use the receipt and deployed entity as evidence. Server restarts clear in-memory rooms and Twitch tokens, requiring a new match and authorization.

### Show the live battle in OBS

This project provides chat-controlled battles captured in OBS. It does not require a native Twitch extension or Bits purchases. The PixelWars reference video uses an extension, so the viewer input method differs.

1. Copy the match's OBS link. In OBS, select Sources > + > Browser, paste the link and set Width 1920 / Height 1080.
2. The copied transparent overlay is suitable above a camera or game source. Remove `?transparent=1` from the URL to include the full illustrated battlefield.
3. Check OBS Preview while sending a command in your connected Twitch channel's chat. Confirm both the dashboard receipt and OBS unit deployment.
4. When ready, start your Twitch broadcast from OBS. Ask a friend to watch your Twitch channel and send `!spawn archer`. Their video includes normal streaming delay; the dashboard receipt helps distinguish delivery from video delay.

For one channel, OBS and PATCH WARS can run on the same computer using localhost. Viewers only need your Twitch stream and Twitch chat; they do not need your local dashboard, a public app deployment or an extension. Keep the app and OBS running. Use the channel link shown by the current match rather than assuming an old connected channel is still active.

## 5. Check real local AI end to end

Use an owned live match with Ollama selected and the configured model installed. Presentation readiness can verify the local model list; it does not generate anything.

1. While proposals are open and combat is running, send `!forge a moss guardian with a shield` in the authorized Twitch chat.
2. Confirm the proposal appears. Close proposals / open vote from Match settings.
3. Send `!vote p1`, using the actual proposal ID shown on your screen.
4. Close voting / forge winner. Then pause combat while local generation runs if needed.
5. Inspect validation and the balance result. An approved unit should show its actual stats and abilities. If rejected, inspect the reason; rejection is an expected safety/balance outcome, not a successful deployment.
6. Resume an approved match. After the deployment countdown, confirm the new unit enters the arena and appears in the unit library.

This is the flow to record as live evidence. An automatic fixture replay does not establish real AI generation.

## 6. Check phones and public access

To open the web spectator page itself on another device, use a public deployment or active tunnel URL; localhost on a phone refers to that phone. Open the spectator link, try portrait/landscape layouts and expanded viewing, and check that controls remain readable without horizontal scrolling. Keep the host computer/server/tunnel running. Watching the Twitch broadcast on a phone does not require this web access. An actual second broadcaster, Shared Chat and raid still need separate consent and live tests.

## Automated checks and profiling

Run `pnpm.cmd typecheck`, `pnpm.cmd lint`, `pnpm.cmd test`, `pnpm.cmd build` and the browser suite. Run `pnpm.cmd run profile:ui` with the app running for local renderer/network measurements. These checks complement live rehearsal and cannot establish public hosting, real Twitch participation or submitted hackathon status.
