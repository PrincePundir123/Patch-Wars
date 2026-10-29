# Local setup

## Offline replay

Install Node 24 and pnpm 10.11.0. From the repository root:

```powershell
pnpm.cmd install
Copy-Item .env.example .env
pnpm.cmd dev
```

Open http://localhost:5173/demo. Vite proxies `/api`, `/auth`, `/ws` and `/health` to port 3001. Use `localhost` consistently: `127.0.0.1` is a different browser origin. No credentials are needed. Reset returns to the lobby; press Start battle to replay.

## Twitch application

1. Register a confidential application in the [Twitch developer console](https://dev.twitch.tv/console/apps). Enable account two-factor authentication if requested.
2. Configure the exact redirect URI `http://localhost:5173/auth/twitch/callback`.
3. Put the Client ID and Client Secret in `.env`, never in chat or frontend code.
4. Generate a private operator key locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Save it as `ADMIN_KEY` in `.env`.
5. Restart the server, open `/dashboard`, unlock with the key, and create a live match.
6. Connect Ember with Twitch and approve `user:read:chat` and `user:write:chat`.
7. When connected, start the match. Type `!spawn archer` in real Twitch chat and verify a visible game response.
8. For two communities, generate an Azure invitation and share it privately with the second broadcaster. It expires after ten minutes and is one-use.

The operator key becomes an HttpOnly session cookie. Channel authorization alone does not grant match control. Tokens stay in server memory. Reauthorize after process restarts.

## AI generation

Set `FORGE_PROVIDER=openai-responses`, `OPENAI_API_KEY` and optionally `FORGE_MODEL` in `.env`. Default model: `gpt-4.1-mini`. Set a provider-project spending cap. Winning live proposals make billed API calls; none were made during offline verification. Demo rooms always use fixtures.

Do not enable `CODEX_ISOLATED` on a normal workstation. The Codex adapter requires separately verified OS isolation; see [security](security.md). Use the no-tool Responses path for the first live demonstration.

| Variable                  | Offline                | Live Twitch / AI            | Production                      |
| ------------------------- | ---------------------- | --------------------------- | ------------------------------- |
| WEB_ORIGIN                | localhost:5173 default | Exact frontend origin       | HTTPS origin, no trailing slash |
| TWITCH_CLIENT_ID / SECRET | Empty                  | Required for Twitch         | Secret store                    |
| TWITCH_REDIRECT_URI       | Unused                 | Exact registered callback   | HTTPS callback                  |
| ADMIN_KEY                 | Optional               | At least 24 characters      | At least 32                     |
| FORGE_PROVIDER            | fixture                | fixture or openai-responses | Explicit choice                 |
| OPENAI_API_KEY            | Empty                  | Required for live AI        | Secret store                    |
| DEMO_MODE                 | true                   | true or false               | Deliberate choice               |
| HOST                      | 127.0.0.1              | Same                        | 0.0.0.0 behind proxy            |

`FORGE_MAX_JOBS_PER_HOUR` defaults to 12 per room, at most two provider attempts each. A room also has a lifetime twelve-job cap preserved across resets. `FORGE_TIMEOUT_MS` defaults to 90000.

## Production-build smoke test

```powershell
pnpm.cmd build
$env:WEB_ORIGIN = 'http://localhost:3001'
pnpm.cmd start
```

Open http://localhost:3001. Development cookies are used unless `NODE_ENV=production`; real production requires HTTPS and a long key. Keep the terminal running. If a port is busy, stop the previous project server before starting another.

## Guided first command

Live matches include a checklist above the arena, direct links to each authorized Twitch channel's chat, and explicit rematch instructions. The checklist distinguishes channel connection, running simulation, received commands and deployed units. Localhost invitations cannot connect another broadcaster's computer; use a publicly reachable deployment for that test.

For free on-device generation, follow [local AI setup](local-ai.md). Ollama is supported alongside fixture and OpenAI Responses providers.

## Spectator controls

Unit labels can be toggled in the dashboard or spectator page. Chat-spawned units are automatically labelled for six simulation seconds; team rings stay orange or blue even when a generated unit has its own palette. Sound is off by default and can be enabled for Forge deployments and match results. OBS keeps a clean control-free view. Reduced-motion preferences suppress the Forge orbit animation.

### A larger battlefield

Select **Theater view** above the scoreboard to fill the browser window, or **Fullscreen** to use native browser fullscreen. The scoreboard, arena, command feedback and viewer tools remain together. Exit using the visible controls or Escape. If fullscreen is unsupported or permission is denied, theater view opens with an explanation.

The entire 1200-by-560 battlefield is fitted without stretching or cropping. Screens with a different aspect ratio have dark space around it; landscape gives phones a larger view. The canvas, connection, label preference and audio controls remain mounted while changing modes. Expanding never pauses, resets or starts a match. Operator actions remain in the control room after exiting; spectator pages cannot control the match. OBS overlays do not show viewing buttons.

Desktop workspaces use persistent left navigation. Phones and tablets use a compact top navigation, stacked panels and touch controls. Twitch callback configuration is available under **Connection setup details** in the connections panel.

## Sharing a development tunnel

Set WEB_ORIGIN to the exact HTTPS tunnel origin and TWITCH_REDIRECT_URI to that origin plus /auth/twitch/callback in the ignored local .env, then restart. Vite allows only the configured hostname. Register the same callback in the Twitch developer console before authorizing through the tunnel. If using VS Code port forwarding, set port 5173 visibility to Public for unauthenticated visitors. Keep the PC, server and tunnel running. Use the tunnel URL consistently for dashboard controls and OBS. Never share ADMIN_KEY; spectators do not need it. To return to local-only use, restore the localhost origins and restart.

## Localhost and tunnel access together

Development accepts the exact configured WEB_ORIGIN plus http://localhost:5173 and http://127.0.0.1:5173 for both browser mutations and WebSockets. Unrelated origins, missing mutation origins and arbitrary ports remain blocked. Production accepts only WEB_ORIGIN. Do not disable the origin check or use a wildcard.

You can unlock the operator dashboard and use the replay at http://localhost:5173 even when WEB_ORIGIN points to a development tunnel. Different hostnames have separate browser cookies: stay on one address throughout a match's operator session.

The Connect Twitch link explicitly carries the current browser origin. The server validates it against the same allowlist, saves the callback with one-use OAuth state and uses the identical callback during token exchange. Register each callback you actually use in the Twitch developer console, for example:

- http://localhost:5173/auth/twitch/callback
- http://127.0.0.1:5173/auth/twitch/callback (only if using this alias)
- Your exact HTTPS tunnel origin followed by /auth/twitch/callback

Generated broadcaster invitations always use the configured public origin. The originating operator's localhost cookies are never shared with the invited broadcaster. A restart still clears in-memory matches and Twitch tokens.

## Local preflight

Run `pnpm run doctor` (Windows: `pnpm.cmd run doctor`) before recording. It checks runtime, exact-origin configuration, operator-key presence/length, Twitch callback shape, Git tracking of .env, the worker bundle, installed Ollama model and local health. It never prints credentials or makes paid generation requests. Passing configuration checks does not prove live Twitch consent, model quality, public hosting or submitted status.
