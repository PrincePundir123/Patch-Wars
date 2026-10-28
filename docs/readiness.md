# Readiness and external completion

Updated October 29, 2026 (IST). The owner explicitly deferred Twitch authorization and requested completion of the offline build. That offline deliverable is complete; external integration acceptance remains separate below.

## Verified locally

- Deterministic two-team combat and a completed match.
- Animated responsive interface and OBS spectator routes.
- Proposals, one-effective-vote rules, real worker checks, deployment and visible split behavior.
- Reset/replay equality including raid and victory.
- Permission, adversarial, reconnect and browser tests.
- Production bundles and measured local evaluation.
- Authentic Codex thread ID and milestone commits.

## Implemented but awaiting live acceptance

- Twitch OAuth and EventSub require the owner's developer app and channel consent.
- Two-channel/Shared Chat/raid behavior requires actual participating accounts/events.
- OpenAI Responses generation requires a configured API key and approved spending budget.
- Codex runtime generation remains disabled until OS isolation is verified.

## Submission tasks still open

- Push the local milestone commits and verify repository accessibility.
- Select and authorize hosting if a public demo is desired; validate HTTPS/WSS.
- Record real Twitch interaction and the actual Codex thread.
- Publish a public YouTube video shorter than three minutes.
- Complete the Devpost form and personally verify “Submitted”.

The application is a verified local implementation, **not yet a fully verified P0 live integration or completed hackathon submission**. No real stream, paid API call, deployment, YouTube publication or Devpost submission was fabricated.

## Explicit scope reductions

No durable PostgreSQL history, crash-resume of active matches, alternate vote modes, Hype Train/monetization/clip/poll APIs, user leaderboards, custom audio, advanced script execution or multi-instance scaling. Balance covers five pure starter rosters; mixed-army tuning and individual unit lifespan instrumentation remain future work. The UI uses plain CSS rather than optional Tailwind. External app builders/design files/task trackers were unnecessary for the local source deliverable.
