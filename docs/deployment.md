# Deployment

No public deployment has been made. This repository provides production bundles, a Dockerfile and health checks. No paid resources were purchased.

## Recommended shape

One persistent Node 24 web service serves the static frontend and WebSockets on the same HTTPS origin. Run one replica; room/session state is in memory. Do not deploy this authoritative process as a request-scoped/serverless function.

Render is one possible host: its [web services support inbound/outbound WebSockets](https://render.com/docs/websocket). Its [free tier has idle/restart limits and is not recommended for production](https://render.com/docs/free). Review [current pricing](https://render.com/pricing) and approve any paid plan before provisioning. No plan or availability guarantee is assumed here. An existing always-on VM with HTTPS is also suitable.

## Build and run

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Environment: `NODE_ENV=production`, `HOST=0.0.0.0`, hosting-assigned `PORT`, exact HTTPS `WEB_ORIGIN`, `ADMIN_KEY` of at least 32 characters, Twitch client credentials and exact HTTPS callback. Choose `FORGE_PROVIDER` explicitly. Store all keys in the host secret store. For live AI set the provider key and account budget. Keep Codex runtime disabled until separately isolated.

Alternatively build the Dockerfile. Container execution is not verified locally because a Docker daemon was not used. Its health check uses port 3001; adjust it if you override the container's port. A platform-native `/health` check works on the service's configured port.

## HTTPS proxy

Terminate TLS in the hosting platform or a reverse proxy. Forward WebSocket Upgrade/Connection headers and allow long-lived connections. Route all paths to the same service. Do not cache `/api` or `/auth`. Set the registered Twitch callback to `https://YOUR_HOST/auth/twitch/callback`. Never expose the development Vite server publicly.

## Verify before sharing

Check `/health`, landing page, demo creation, 200-battle Forge approval, OBS rendering, owner-only controls, WSS reconnect and a genuine Twitch command. Then verify the exact public link in a second browser. Record the deployment URL only after it works. A sleeping free instance is unsuitable for a live stage demonstration.

## Restart and rollback

Announce maintenance between matches. Stop new matches, finish the current round, then deploy. Sessions, matches and tokens are memory-only; reauthorize after restart. To roll back, select a previously tested commit, rebuild, deploy and rerun the smoke checks. Do not mix versions across replicas.

## Troubleshooting

| Symptom                      | Check                                                          |
| ---------------------------- | -------------------------------------------------------------- |
| 403 mutation                 | Browser origin equals WEB_ORIGIN; operator owns match          |
| Twitch callback fails        | Exact redirect URI, fresh state/session, correct client secret |
| Reconnecting forever         | Proxy WSS support, server logs, service awake                  |
| Forge rejected               | Actual error, provider config, quota, balance report           |
| Blank arena                  | WebGL/hardware acceleration and browser console                |
| Match not found after deploy | Expected in-memory restart behavior; create a new match        |
