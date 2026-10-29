# Readiness and external completion

Updated October 29, 2026 (IST).

## Verified

- Offline deterministic match, Forge worker, split behavior, reset/replay and OBS presentation.
- Real single-channel Twitch authorization and commands: inspected the live room for the connected channel, Archer and Guardian deployment receipts, and an Ember victory. This was not video capture.
- Real local Ollama generation: a guardian passed 200 balance engagements at a 42% win rate in about 56 seconds across two attempts. See docs/evaluation/local-ai.json. This is one concept, not a general model-quality benchmark.
- Complete local worker flow: synthetic normalized chat, voting, real Ollama generation, validation, balance, reveal and two deployed units passed in about 29 seconds across two attempts. See docs/evaluation/local-forge-flow.json.
- Priority improvements: visible command receipts and spawn highlights, direct channel-chat links and setup guidance, readable Forge cards with a three-second live reveal, free local generation, optional labels and muted-by-default event audio.
- Browser regression suite covers desktop/mobile, complete fixture Forge/OBS flow, setup errors, labels, audio toggles and command feedback.
- Operator-origin repair: localhost unlock, owned live-match creation and connected browser snapshots were checked against the running development server while WEB_ORIGIN remained configured for the tunnel. HTTP mutations and WebSockets now share an exact allowlist; production still permits only WEB_ORIGIN. OAuth callbacks remain on the explicitly allowed initiating address.
- Latest repair verification: 114 automated tests and eight Chromium browser tests passed; TypeScript, lint, production build and all nine local preflight checks passed. See [origin repair evidence](origin-fix-verification.md). Configuration checks do not establish live authorization or submission.
- Field Studio UI: approved ivory workspace and forest battle stage implemented across product surfaces; theater and native fullscreen include mobile fallback, keyboard exit and retained match state. Browser verification adds five expanded-view checks to the eight existing flows. See [Field Studio implementation](field-studio-verification.md) and the current design-qa.md report.

## Still needs owner participation or external verification

- Record a complete real Twitch proposal -> vote -> local AI -> deployment flow.
- Test a second broadcaster, native Shared Chat and actual raid events.
- For remote web spectators or a remote second broadcaster, choose and authorize public hosting; verify HTTPS/WSS and OAuth callback on that origin. A single-channel OBS broadcast can run locally; Twitch viewers do not need public app access.
- Record authentic Codex contribution evidence and publish a public video under three minutes.
- Fill the Devpost form, personally verify eligibility and confirm Submitted status.

Initial six implementation commits were pushed. New improvement commits are recorded in Git history. No public deployment, YouTube publication, Devpost submission or paid API execution is claimed.

Latest priorities 1–5 add public-asset/API rate-limit separation, deferred production renderer loading, private presentation readiness, compact snapshots and rendering suspension, and a copy-only command guide. Verification includes 122 automated tests across 23 files and 20 browser tests against a built server, plus typecheck, lint and build. See [measurements and scope](priority-improvements.md) and [manual Twitch/OBS rehearsal](manual-rehearsal.md). Priority 6 (persistent match summaries) remains excluded. This run does not establish a new live Twitch broadcast or second-channel acceptance.

## Limits

Local-model output may fail validation or balance. The Ollama adapter uses one signature ability per unit for reliability on the installed small model; the shared engine still supports up to three abilities. It never silently switches failed AI output to fixtures. CPU generation may take a minute: pause combat while generating, then resume after approval. Tokens and match state remain memory-only, requiring Twitch reauthorization after server restarts. No durable history, crash recovery, monetization, Hype Train, clips or multi-instance scaling is implemented. Synthesized event cues are available; custom audio assets are not included.
