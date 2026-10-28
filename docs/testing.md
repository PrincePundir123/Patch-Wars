# Testing

Final local verification: **87 automated tests across 11 files, plus four Playwright browser tests passed**. Type checking, lint and production compilation passed. See [verification record](verification.md) for evidence and limitations.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm evaluate
pnpm soak
pnpm audit --prod
```

Vitest builds and tests the actual worker. Coverage includes deterministic combat, ability bounds, malicious blueprints, 20 valid/30 adversarial concepts, voting, permissions, OAuth state/scopes, source attribution, duplicate events, rate limits, EventSub migration/recovery and read-only client sockets. Complete replay integration observes splitting, raid and victory, resets, then compares the entire game state exactly.

Playwright checks landing/mobile layouts, the Forge-to-deployment flow, pause/reset, clipboard, OBS and invalid operator access. Screenshots are in `docs/screenshots`; failure traces are ignored. Browser metrics record local command-to-proposal presentation and frame intervals.

Evaluation uses fixture output, 200 battles per candidate and 1,000 duplicate events. The soak runs 120 two-minute matches: four accelerated simulation hours, not four real hours of browser/network uptime. It checks caps and finite values and records uncollected heap growth; this is not proof of absence of leaks.

CI runs the checks on Ubuntu/Node 24. Local checks ran on Windows/Node 24. Remote CI execution is not claimed until pushed and observed.

Synthetic tests do not establish real Twitch eligibility, provider billing, public hosting or actual stream interaction. Complete the live acceptance checklist before submission.
