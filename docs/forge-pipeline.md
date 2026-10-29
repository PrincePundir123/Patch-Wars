# Forge pipeline

Moderated idea → combined vote → provider → strict schema → safety/resource gate → simulation → registration → spawn. Fixture mode still executes validation and balancing.

`ForgeProvider.generateUnit(idea, signal)` returns untrusted data. FixtureForgeProvider maps concepts to four stored units and is explicitly not a general generator. OpenAIForgeProvider uses no-tool structured Responses output. CodexForgeProvider uses the official SDK, temporary directory, read-only sandbox, disabled network/search and an isolation gate. Live provider execution is unverified. References: [Codex SDK](https://developers.openai.com/codex/sdk/), [structured output](https://platform.openai.com/docs/guides/structured-outputs).

Prompt version `forge-v1` lives in `apps/forge-worker/src/pipeline.ts`. Viewer text is encoded as data. Users cannot choose provider/model, paths or tools.

| Operation | Trigger | Bounds                                       |
| --------- | ------- | -------------------------------------------- |
| shield    | spawn   | 1–50 shield HP                               |
| slow      | hit     | 1–60 ticks, 50% movement                     |
| splash    | attack  | Every 2–8 attacks; 1–12 damage; radius 10–90 |
| heal      | tick    | Every 20–100 ticks; 1–12 HP; radius 20–140   |
| split     | death   | 1–3 children; 15–40% HP; no child abilities  |

Blueprints are capped at 10 KB and three unique operations, with finite bounded stats, allowlisted visuals and no extra keys. Children have 35% base attack. There are at most 160 entities. New operation combinations are allowed; arbitrary executable code is not.

Each candidate fights 200 cost-matched engagements, alternating sides against five starter classes, seeds 100–299. A 30-energy budget determines army counts. Compare surviving HP at elimination or 800 ticks. Report win rate, damage, peak entities, execution time and damage/energy. `meanLifespanTicks` currently measures engagement length, not individual lifespans.

The broad initial acceptance interval is 25–75%, not a universal fairness guarantee. Pure-roster tests underrepresent support in mixed armies. The original six-cost slime failed at 9%; measured calibration reduced its cost to five before admission. No gate was bypassed.

Live providers get at most two attempts; fixture failures reject immediately. Limits are one worker/room, 90 seconds, twelve jobs/hour and twelve jobs/room lifetime, preserved across resets. Responses output is capped at 2,400 tokens/attempt. Set a provider-account monetary budget; dollar billing enforcement is not claimed.

Failures reject the job and preserve combat. UI stages come from actual worker/server transitions. Approved blueprints are revalidated, get server-owned IDs, and spawn twice for the winning team. Demo deployment uses tick 540, waiting just before it if necessary for deterministic replay. Live combat never waits.

## Broadcast reveal
Approved blueprints show a unit card, readable ability descriptions, weaknesses and exact balance metrics. Live matches wait 60 simulation ticks (three seconds) after approval before deployment; pausing freezes this countdown. A full arena keeps the unit queued. The deterministic replay retains its tick-540 deployment. Fixture and model labels are always explicit.

