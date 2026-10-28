# Genuine Codex contribution

This project was implemented in the current Codex coding session on October 28, 2026.

**Thread ID:** `01a18312-00c1-7360-91d0-27e410da449c`

Provenance: read from the running Codex environment's `CODEX_THREAD_ID`; not synthesized. The owner should confirm this same thread using `/status` and record it on screen before submitting. No private conversation export or credential file is included.

## Work in this thread

- Deterministic engine and bounded ability interpreter.
- Twitch normalization, OAuth, EventSub reconnect handling and tests.
- Authoritative rooms, permissions, voting and worker-based Forge.
- Adversarial prompts, balance calibration and exact full-replay tests.
- React/PixiJS broadcast UI and OBS mode.
- Browser verification, dependency audit fixes, measured evaluation and documentation.

## Milestone commits

- `413fca4` — workspace and deterministic battle simulation.
- `acd7869` — OAuth and source-aware EventSub adapter.
- `348feec` — authoritative rooms, Forge validation and deployment.
- `ddf675c` — broadcast arena, dashboard, OBS overlay and patched dependencies.
- `f6cfbfd` — Forge timeout/capacity hardening and replay/reconnect regression tests.
- The final documentation commit is available in `git log --oneline`.

The runtime fixture provider is not Codex usage. The optional Codex runtime adapter has not been executed with live credentials. Hackathon build evidence refers to actual implementation work in this thread.

## Follow-up review prompts

**Twitch review:** “Review packages/twitch-adapter/src/index.ts and apps/server/src/app.ts against current Twitch docs. Check scopes, user-token Shared Chat behavior, revocation and reconnect. Add regression tests for any concrete defect. Run pnpm test and pnpm typecheck.”

**Forge review:** “Review apps/forge-worker and packages/game-core for resource exhaustion, invalid generated output and recursive spawning. Add meaningful adversarial cases; do not weaken validation to pass fixtures. Run pnpm test, pnpm evaluate and pnpm soak.”

**Live debugging:** “Using my locally configured environment without printing secrets, diagnose a real Twitch command that is not reaching the arena. Trace OAuth identity, subscription, normalization, room command and snapshot boundaries. Record observed evidence and fix the failing boundary.”

Capture a real thread, the commands/results and relevant commits for the video. Do not claim a review or test that has not run.
