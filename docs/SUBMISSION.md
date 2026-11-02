# PATCH WARS: Devpost and YouTube submission copy

Paste-ready text for the Codex x TwitchCon Hackathon (https://twitchcon-codex.devpost.com/). Each heading below is the Devpost field name.

Where everything is:

- Film (1080p, 2:46): `~/Downloads/PatchWars-film.mp4`; phone copy `~/Downloads/PatchWars-film-720p.mp4`; captions `~/Downloads/PatchWars-film.srt`. Rebuild from code with `video/build.py` (see video/README.md).
- YouTube thumbnail (1920×1080): `~/Downloads/PatchWars-youtube-thumbnail.png`. Devpost thumbnail (3:2): `~/Downloads/PatchWars-devpost-thumbnail.png`.
- Devpost gallery images (3:2, 1500×1000): `docs/screenshots/landing-hero.png`, `streamers-section.png`, `bits-estimator-sigils.png`, `forge-reveal-sigil.png`, `stream-view.png`, plus the existing `chat-after-repair.png` (real Twitch channel).

Notes for the owner before pasting:

- `<!-- source: ... -->` comments mark where each number comes from. Devpost Markdown normally hides HTML comments, but delete them if you want a clean paste.
- The real Git remote is `https://github.com/PrincePundir123/Patch-Wars` (from `git remote -v`), not a `Prashant-thakur77` URL. Confirm the latest commits are pushed before submitting.
- Anything marked "owner to choose" or "owner must confirm" is your decision, not a fact from the repo.

---

## 1. Project overview

### Project name

```
PATCH WARS: Twitch chat invents the army
```

40 characters (limit 60).

### Elevator pitch

```
A Twitch auto-battler where chat invents new soldiers, votes on the best idea, and watches it fight. Two communities, two castles. Every idea is safety-checked and balance-tested first.
```

185 characters (limit 200).

---

## 2. Project details

### About the project

## Inspiration

The best moments on Twitch are made by chat, but most stream games only let viewers press buttons someone else designed. We wanted viewers to design the buttons. In PATCH WARS a viewer types an idea for a new soldier, the community votes, and a few seconds later that soldier walks onto the battlefield and fights for their team. The catch is that generated mechanics are dangerous: they can be broken, unfair, or try to run code. So the hard part, and the fun part, became making "chat invents a unit" safe and fair enough to run live.

## What it does

PATCH WARS is a castle-to-castle auto-battler controlled from Twitch. Two teams, Ember and Azure, push soldiers down a shared lane. Viewers:

- deploy soldiers with chat commands like `!spawn archer`, `!attack` and `!defend`, spending shared team energy;
- pitch new units with `!forge <idea>` and vote with `!vote p1` (one effective vote per Twitch account);
- watch the winning idea go through the **Forge**: AI generation, strict schema and safety checks, then 200 headless balance engagements against the five starter classes before it is allowed to spawn. <!-- source: docs/forge-pipeline.md -->

Approved units get a reveal card with their abilities, weaknesses and real balance numbers, a three-second countdown, and then they deploy into the live match. Every warrior also gets an original Forge sigil, drawn procedurally in code from its blueprint, so the same unit always gets the same emblem. A small synthesized sound kit (Web Audio, no audio files, muted by default) marks spawns, Forge reveals and victory.

Every chat command gets a visible receipt in the arena and the OBS overlay, and the exact soldier it spawned is highlighted for a few seconds, so viewers can see that their message did something.

## How streamers use it

- **Single streamer.** Open the dashboard, create a live match and authorize your channel with Twitch OAuth. Add the overlay link to OBS as a browser source. Your viewers play by typing commands in your normal Twitch chat; they need no extra account or extension. With one channel connected, Azure is a server-controlled opposing army.
- **Two-streamer collab battles.** Invite a second broadcaster with a private, expiring link. Each community controls one castle. Messages are attributed to their original channel, so a message replicated through Twitch Shared Chat still counts once, for the right team. <!-- implemented and tested; two-channel and Shared Chat live verification pending per docs/readiness.md -->
- **Raids.** An incoming raid sends reinforcements to the raided channel's team, scaled by raid size and capped at 8 units. <!-- source: docs/twitch-integration.md (raid strength formula); real raid events not yet verified per docs/readiness.md -->
- **Bits-powered deployments.** A native Twitch Extension can sell fixed soldier activations from 10 to 50 Bits. Twitch handles the confirmation; our server verifies the signed receipt and the transaction through Helix before any soldier spawns, and records it in a SQLite ledger so a deployment is never delivered twice. <!-- source: docs/paid-deployments.md --> For streamers this is a new earning loop tied to gameplay instead of a donation box. The landing page has a "For streamers" section with an earnings estimator based on the broadcaster's share of Bits used in an Extension (80% of 1 US cent per Bit); it is clearly labelled as an estimate. Paid mode is off by default, and real Twitch review of the Extension and a live Bits transaction are still pending.
- **OBS overlay.** A transparent 1920 x 1080 overlay or a full battlefield page. Overlay links are view-only.
- **Twitch Extension.** A transparent video-overlay panel with a compact soldier tray, so viewers can deploy by clicking instead of typing. It is built and tested against mocked Twitch services, but not yet installed through Twitch Hosted Test or approved.

## How we built it

Most of PATCH WARS was built in a single OpenAI Codex thread (`01a18312-00c1-7360-91d0-27e410da449c`). <!-- source: docs/codex-evidence.md --> Codex wrote the deterministic engine, the ability interpreter, the Twitch integration, the Forge worker, the authoritative server, the React and PixiJS interface, the art pipeline and the test suites, and it diagnosed real failures along the way. A final polish pass (the streamer landing section, Bits estimator, procedural sigils and sound kit, and this write-up) was done with Claude Code.

It is a TypeScript pnpm workspace:

- `packages/shared`: Zod schemas for every boundary and wire contract.
- `packages/game-core`: a seeded, deterministic 20 Hz simulation with no IO, clocks or unseeded randomness. The same seed and inputs always replay to the same match.
- `packages/twitch-adapter`: OAuth, EventSub over WebSocket, source attribution and deduplication.
- `apps/forge-worker`: AI providers, safety checks and headless balance simulation in a worker.
- `apps/server`: Fastify server that owns rooms, permissions, voting, Forge jobs and snapshots.
- `apps/web`: React operator dashboard and PixiJS spectator renderer.
- `apps/extension`: the native Twitch video-overlay Extension.

Generated units are data, never code. A unit can only use five allowlisted operations (shield, slow, splash, heal, split), at most three per unit, each with hard numeric bounds. The interpreter has no `eval`, `Function`, VM or dynamic imports. Blueprints are capped at 10 KB and the battlefield at 160 entities. <!-- source: docs/forge-pipeline.md, docs/security.md -->

Each candidate unit fights 200 cost-matched engagements, alternating sides against all five starter classes, and must land between a 25% and 75% win rate to be admitted. <!-- source: docs/forge-pipeline.md --> Providers include a fixture provider for the demo, free local Ollama, OpenAI Responses, and a Codex SDK provider that stays gated off until OS-level isolation is verified.

On the Twitch side, the server subscribes to `channel.chat.message`, `channel.raid` and Shared Chat events over EventSub WebSocket, with keepalive, reconnect and revocation handling. Replies go through the Helix Send Chat Message API. Tokens stay on the server and never reach snapshots, the browser bundle or logs.

## Proof

| What we measured                         | Result                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live Twitch chat commands                | Archer and Guardian deployments confirmed by receipts in an authorized channel <!-- source: README.md "Verification status", docs/readiness.md -->                                   |
| Real local AI unit (Ollama `qwen2.5:3b`) | Passed 200 balance engagements at a 42% win rate, about 56 s for generation plus balance <!-- source: docs/evaluation/local-ai.json (winRate 0.42, generationAndBalanceMs 55529) --> |
| Adversarial prompts rejected             | 30 / 30 <!-- source: docs/evaluation/results.md -->                                                                                                                                  |
| Fixture concepts accepted                | 20 / 20 <!-- source: docs/evaluation/results.md -->                                                                                                                                  |
| Forge latency (fixture provider)         | p50 684 ms, p95 952 ms <!-- source: docs/evaluation/results.md -->                                                                                                                   |
| Simulation speed                         | 3,600 ticks in 55.9 ms (64,379 ticks/s) <!-- source: docs/evaluation/results.md -->                                                                                                  |
| Duplicate message suppression            | 1,000 / 1,000 <!-- source: docs/evaluation/results.md -->                                                                                                                            |
| Accelerated soak                         | 4 simulated hours, 288,000 ticks, 0 failures <!-- source: docs/evaluation/soak.json -->                                                                                              |
| Automated tests                          | 161 tests across 31 files passing <!-- source: docs/paid-deployments.md, "Implementation verification" -->                                                                           |

Fixture numbers measure our pipeline, not model quality. Two-channel Shared Chat, a real raid, a live Bits transaction and Extension Hosted Test have not been verified yet.

## Challenges we ran into

- **Counting a message once.** With Shared Chat, one message can arrive through several channels. We attribute by source channel and source message ID so it counts once, for the community that sent it.
- **Expressive but safe mechanics.** We had to give viewers enough building blocks to invent interesting units while making arbitrary code execution impossible. A small bounded ability language was the answer.
- **Balance that says no.** Our own demo star, a splitting slime, failed the balance gate at a 9% win rate. We recalibrated its cost from 6 to 5 instead of bypassing the gate. <!-- source: docs/forge-pipeline.md -->
- **Real models are messy.** Local Ollama output failed validation and balance on early attempts. We kept the gates strict and retried within a two-attempt cap instead of silently falling back to fixtures.
- **Paid actions without trusting the browser.** A browser callback never spawns a soldier. The server checks the signed receipt and the Helix transaction, and an interrupted delivery goes to the broadcaster for review instead of being guessed.

## Accomplishments that we're proud of

- A viewer idea really does go from chat to a vote, a worker, 200 simulated battles and a deployed unit that behaves the way it was described.
- Real Twitch chat commands spawned soldiers in a live authorized channel, and a real local model produced a unit that passed the balance gate.
- The simulation is fully deterministic. The same seed and inputs replay to exactly the same match, and our tests check this, which made debugging much easier.
- Every simulated or fixture surface is labelled, so the demo never pretends to be live.

## What we learned

Showing the engineering checks on stream, like the balance report on a Forge reveal card, turns safety into part of the show. Source attribution matters as much as command parsing. And a constrained language is what makes "let the audience generate mechanics" something you can run live.

## What's next

- Verify two-channel collab battles and Shared Chat with a second broadcaster, and real raids.
- Get the Extension through Twitch Hosted Test and review, then run a controlled live Bits transaction.
- Persist match history and tune mixed-army balance from live play.
- Creator themes and community tournaments.

### Built with

```
typescript, node.js, react, pixi.js, fastify, websockets, zod, zustand, vite, vitest, playwright, pnpm, sqlite, twitch-eventsub, twitch-api, twitch-oauth, twitch-extensions, twitch-bits, twitch-embed, obs-studio, ollama, openai-codex, codex-sdk, web-audio, claude-code
```

25 tags.

### Try it out links

- Source code: https://github.com/PrincePundir123/Patch-Wars
- Demo video: https://www.youtube.com/watch?v=2WlwBF28-nU

Owner note: this is the real remote from `git remote -v`. Change it only if the repo has moved to another account.

### Image gallery captions

1. **Landing hero:** PATCH WARS: two communities, one battlefield. Chat invents the army.
2. **Streamer earnings section:** The "For streamers" section with an illustrative Bits earnings estimator (estimate only, based on 80% of 1 cent per Bit going to the broadcaster).
3. **Live castle battle:** Ember and Azure soldiers push down the castle lane over the host's Twitch video.
4. **Community Forge vote:** Viewers pitch units with `!forge` and vote with `!vote`. One vote per Twitch account.
5. **Forge reveal with generated sigil:** An approved unit's reveal card: abilities, weaknesses, its 200-engagement balance result and a procedurally drawn sigil.
6. **Bits extension panel:** The Twitch Extension soldier tray with fixed 10 to 50 Bits activations. Test screenshot; no real Bits were spent.
7. **OBS overlay:** Transparent 1920 x 1080 OBS overlay with command receipts.
8. **Architecture:** Twitch EventSub to an authoritative server and deterministic 20 Hz simulation; ideas go through the Forge worker's safety and balance checks before they spawn.

---

## 3. Additional info

### Submitter type

Owner to choose (Individual or Team, matching who worked on it).

### Country of residence

India

### Repository URL

https://github.com/PrincePundir123/Patch-Wars

### Codex session ID

```
01a18312-00c1-7360-91d0-27e410da449c
```

<!-- source: docs/codex-evidence.md. Owner should confirm with /status in Codex before submitting. -->

### Explain how your project meets the main technology requirement

PATCH WARS was built with OpenAI Codex and runs on Twitch.

- **OpenAI Codex.** Most of the project was built in one Codex thread (session ID above): the deterministic engine, ability interpreter, Twitch integration, Forge worker, server, React and PixiJS interface, art pipeline and the test suites. Codex also found and fixed real problems, such as a demo unit that failed the balance gate and invalid local model output. A final polish pass was done with Claude Code.
- **Codex SDK.** The Forge includes a Codex SDK provider that runs in a read-only sandbox with network disabled. It is optional and gated off until OS-level isolation is verified; local Ollama and a fixture provider are used otherwise.
- **Twitch OAuth.** Each broadcaster authorizes their own channel with the authorization-code flow (`user:read:chat`, `user:write:chat`). Viewers can sign in separately to deploy soldiers. Tokens stay on the server.
- **Twitch EventSub.** WebSocket subscriptions to `channel.chat.message`, `channel.raid` and Shared Chat lifecycle events drive commands, votes, raids and team attribution.
- **Twitch Helix API.** Send Chat Message for bot replies, and Get Extension Transactions to verify every Bits purchase.
- **Twitch Extensions and Bits in Extensions.** A native video-overlay Extension with fixed soldier products from 10 to 50 Bits, verified receipts and a persistent ledger. Implemented and tested; Twitch review and a live transaction are pending, and paid mode is off by default.
- **Twitch embedded player and chat.** The live arena shows the host's official Twitch video behind the battlefield and the official Twitch chat embed beside it.
- **OBS browser source.** A transparent overlay link for streaming the battle.

Single-channel chat commands and local AI generation have been verified live. Two-channel Shared Chat has not yet been verified.

### Explain how streamers and their community on Twitch use your project

**Streamer**

1. Open the PATCH WARS dashboard, create a live match and authorize your Twitch channel.
2. Add the copied overlay link to OBS as a 1920 x 1080 browser source and go live.
3. Optional: invite a second streamer with a private link so each community controls one castle.
4. Optional: enable the Twitch Extension so viewers can deploy by clicking, and turn on Bits activations once Twitch has approved the Extension.
5. Start the battle, open a Forge round, moderate proposals if needed, and run rematches from the dashboard.

**Viewer**

1. Watch the stream and type `!join`, then `!spawn archer`, `!attack` or `!defend` in chat to send soldiers for your streamer's team.
2. Type `!forge <your idea>` to pitch a new unit, for example "a slime that splits into two when it dies".
3. Vote with `!vote p1`. The winning idea is generated, checked and balance-tested, then revealed on stream and deployed for your team.
4. In a collab battle, your messages count for your own streamer's castle, even in Shared Chat.
5. With the Extension, click a soldier in the overlay tray instead of typing, or spend 10 to 50 Bits on a soldier when paid mode is on.

### Did you develop new skills during this hackathon? (owner to choose)

Suggested answer: Yes. Twitch EventSub over WebSocket, Shared Chat source attribution, the Twitch Extension and Bits receipt flow, and designing a bounded ability language for AI-generated game content.

### How likely are you to use Codex again? (owner to choose)

Suggested answer: Very likely.

### Eligibility checkboxes

Owner must confirm personally. Do not tick these on the owner's behalf.

- [ ] Eligibility checkbox 1 (owner must confirm personally)
- [ ] Eligibility checkbox 2 (owner must confirm personally)
- [ ] Eligibility checkbox 3 (owner must confirm personally)

---

## 4. YouTube

### Title

```
PATCH WARS: Twitch chat invents the army | Codex x TwitchCon Hackathon
```

70 characters (limit 100).

### Description

```
Twitch chat is full of people who care, and almost nothing they type changes what happens on stream. PATCH WARS turns a Twitch channel into a live strategy game: chat commands an army, invents new warriors, votes on them, and backs its side with Bits.

In this video: chat commands spawning soldiers, a Community Forge vote, an AI-drafted warrior that passes a safety gate and 200 balance battles, its crest drawn in code, the Bits soldier drops and earnings estimator for streamers, two-streamer collab battles, a real match on a Twitch channel with Twitch chat embedded, the architecture in 3D, and how it was built in one OpenAI Codex thread. The local replay's chat and Forge output are simulated and labelled on screen.

Code: https://github.com/PrincePundir123/Patch-Wars
Built for the Codex x TwitchCon Hackathon: https://twitchcon-codex.devpost.com/
Built with OpenAI Codex, TypeScript, React, PixiJS, Fastify, Twitch EventSub, Twitch Extensions and Bits, Ollama and the Web Audio API. Narration is synthesized; music is composed in code.

0:00 The problem
0:25 Chat commands
0:41 The Forge
1:09 Streamers earn, collabs and live on Twitch
1:45 Under the hood
2:02 Built with Codex
2:25 Recap
```

### Tags

```
Twitch, TwitchCon, Codex, OpenAI Codex, Codex x TwitchCon Hackathon, Devpost, hackathon, auto battler, Twitch game, Twitch chat game, Twitch extension, Twitch Bits, EventSub, OBS, PixiJS, React, TypeScript, Ollama, AI game design, interactive streaming
```

### Chapters

Already included at the end of the description above (each chapter is 10 s or longer, computed from the film's timeline).

### Upload settings

Visibility **Unlisted** or **Public** (no password), audience "No, it's not made for kids", thumbnail `~/Downloads/PatchWars-youtube-thumbnail.png`, subtitles `~/Downloads/PatchWars-film.srt` (the film already has burned-in captions, so upload the SRT only if you also want YouTube's CC track).
