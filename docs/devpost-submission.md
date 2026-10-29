# PATCH WARS — submission draft

Editorial note: update live-verification statements and links before publishing. This draft deliberately distinguishes working local features from pending account-based verification.

## Inspiration

Twitch communities already create the best moments of a stream together. We wanted to give that creativity a direct role in gameplay: a viewer should be able to suggest a new mechanic and then watch it fight for their team.

## What it does

PATCH WARS pits Ember and Azure against each other in an audience-controlled auto-battler. Viewers spawn units, propose concepts and vote. The winning idea passes through the Forge: provider generation, strict validation, resource checks and 200 headless engagements. Approved units enter the same live simulation. A splitting slime demonstrates how a viewer concept can become observable behavior.

The local replay is complete and explicitly labelled simulated. Single-channel Twitch commands have been verified against live match state. A real local Ollama guardian generation passed the 200-battle gate at 42% wins. A recorded end-to-end Twitch proposal-to-AI deployment and two-channel verification remain pending.

## How we built it

TypeScript, React, PixiJS, Fastify, WebSockets, Zod and pnpm. One authoritative server owns a seeded 20 Hz simulation. An allowlisted ability interpreter runs data rather than arbitrary generated JavaScript. Workers keep validation/simulation separate from combat. Browser clients interpolate read-only snapshots. Streamers operate matches through owned sessions; spectators use an OBS-compatible URL.

## How we used Codex

Codex implemented the engine, Twitch integration, Forge, interface and regression tests in thread `01a18312-00c1-7360-91d0-27e410da449c`. It diagnosed a failed balance gate, calibrated the slime, tested the complete replay, and corrected rendering and dependency issues. See docs/codex-evidence.md and the actual commit history. Runtime fixture output is not presented as Codex execution.

## Challenges

Shared messages must count once for their original community. Generated mechanics must remain expressive without opening arbitrary execution. Deterministic replay must survive asynchronous generation. Balance checks must reject a weak unit even when it is the planned demo star.

## Accomplishments

The local flow runs from a normalized event through voting, a real worker and simulations to a deployed unit that splits. Automated tests verify replay equality, permissions, adversarial input and reconnect recovery. A four-hour accelerated simulation soak completed without invariant failures. Actual test counts and timing data should be copied from the final evaluation artifacts immediately before submission.

## What we learned

Visible engineering checks can become part of the entertainment. Source attribution matters as much as command parsing, and safe generated mechanics require an intentionally constrained language. Fixture transparency makes the demo reproducible while preserving an honest distinction from live integrations.

## What's next

Finish real-account verification, improve mixed-army balancing, add durable match history, and explore creator themes and tournaments. Optional Twitch monetization and clips come after a reliable core.

## Try it

Existing repository: https://github.com/PrincePundir123/Patch-Wars (verify the implementation commits have been pushed).

Hosted demo: not deployed. Video: not published. Devpost: not submitted.

Local instructions: `pnpm install`, `pnpm dev`, then http://localhost:5173/demo.

## Built with

TypeScript, Node.js, React, PixiJS, Fastify, WebSockets, Twitch OAuth/EventSub, Ollama, Zod, Zustand, Vite, Vitest, Playwright, OpenAI Codex and pnpm. Ollama provides local generation without paid API calls. OpenAI Responses is an optional runtime provider; paid execution remains unverified.
