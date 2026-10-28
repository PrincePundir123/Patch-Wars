# Contributing

Read AGENTS.md first. Install Node 24 and pnpm, then run `pnpm install` and `pnpm dev`.

Keep game-core deterministic and IO-free. Validate every external input. Add tests for new abilities, permissions and failure paths. Describe any Twitch scopes or deployment requirements in docs. Keep all tokens outside source control. Use conventional commits for cohesive changes.

Before proposing a change, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; run `pnpm test:e2e` for UI or transport changes. Provider fixtures are test artifacts and must never be presented as live AI or Twitch evidence.
