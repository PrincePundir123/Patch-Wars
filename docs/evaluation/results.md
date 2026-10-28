# Local evaluation

Run: `pnpm evaluate`

Date (UTC): 2026-10-28T16:06:27.644Z

Hardware: 13th Gen Intel(R) Core(TM) i5-13420H; 12 logical cores; 16 GB RAM; win32; Node v24.13.0.

| Metric | Measured value |
|---|---|
| Fixture concepts | 20 |
| Adversarial concepts | 30 |
| First/final fixture acceptance | 20/20 (no fixture retries) |
| Forge p50 | 1296.9 ms |
| Forge p95 | 1824.7 ms |
| Adversarial prompts rejected | 30/30 |
| Simulation 3600 ticks | 38.6 ms |
| Simulation throughput | 93241 ticks/sec |
| Duplicate suppression | 1000/1000 |

Every accepted blueprint was tested in 200 cost-matched engagements, alternating sides across five starter baselines with seeds 100–299. Accepted interval: 25–75%; this broad initial heuristic is not competitive balance proof. See results.json for each unit.

## Limitations
These are stored fixture outputs, not evidence of model quality or live generation latency. Prompt filtering is a conservative local filter, not comprehensive multilingual moderation. Live Twitch latency, live AI billing and public deployment were not measured. Browser timing and accelerated soak results are recorded separately. Hardware scheduling affects wall-clock results.
