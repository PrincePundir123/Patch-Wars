# PATCH WARS engineering guide

Build a Twitch-controlled two-community auto-battler with safe generated mechanics.

## Ownership and architecture
- `packages/shared`: strict boundary schemas and wire contracts.
- `packages/game-core`: deterministic 20 Hz simulation and bounded ability interpreter; no IO, clocks, or unseeded randomness.
- `packages/twitch-adapter`: OAuth, EventSub, source attribution and deduplication.
- `apps/forge-worker`: provider adapters, safety checks and headless balance simulations.
- `apps/server`: authoritative rooms, permissions, voting, jobs and snapshots.
- `apps/web`: React operator interface and PixiJS spectator renderer.

## Conventions
Use strict TypeScript, explicit boundary validation, small modules and conventional milestone commits. Do not overwrite user changes. No arbitrary generated code execution. Never put credentials in source, browser bundles, snapshots or logs. All mutations require server authorization. Keep demo/fixture labels visible. Cap entities, input sizes, retries and AI calls. Generated output is untrusted data.

## Commands and completion
`pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm evaluate`.
Add meaningful deterministic, security and integration tests with each feature. Run relevant checks before committing. Document actual results and external blockers. Live Twitch, live AI, deployment and submission are complete only after actual verification. Update README and relevant docs whenever behavior changes.
