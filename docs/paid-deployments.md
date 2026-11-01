# Bits soldier deployment

PATCH WARS supports fixed Twitch Bits actions in its native Extension. This is optional: `PAID_DEPLOYMENTS_ENABLED=false` keeps the existing free team-energy mode. Demo rooms are always free and labeled. Nothing charges a card or handles a viewer's payment details; Twitch owns the Bits confirmation and settlement.

## Product catalog

| Soldier | SKU | Bits for one deployment |
| --- | --- | ---: |
| Sprinter | `patchwars.sprinter.v1` | 10 |
| Archer | `patchwars.archer.v1` | 20 |
| Guardian | `patchwars.guardian.v1` | 30 |
| Healer | `patchwars.healer.v1` | 40 |
| Bomber | `patchwars.bomber.v1` | 50 |

The versioned server catalog is authoritative. There are no dollar-price claims, wallets, paid random rewards, money prizes or generated-unit products. Existing energy costs and combat stats do not change. Payment does not guarantee a kill, win, soldier lifetime or reward. Official Bits wording in the UI uses “Activate” and “Bits,” not donations or a dollar checkout.

## Configure and verify

1. Use Node.js 24 or newer. The ledger uses built-in `node:sqlite`; no database account or paid storage integration is required. Run a single persistent server process with persistent local disk.
2. Create/configure the Twitch Extension, complete Twitch's monetization onboarding and verify that the broadcaster can accept Bits. Add all five SKUs above at their exact amounts. Configure the Extension helper, backend HTTPS connect origin, identity sharing, and viewer URL `viewer.html`. Upload the contents of `dist/extension` after `pnpm build:extension`.
3. Set private server environment variables: `TWITCH_EXTENSION_CLIENT_ID`, `TWITCH_EXTENSION_SECRET` (base64 JWT signing secret), and `TWITCH_EXTENSION_CLIENT_SECRET` (the Extension's OAuth client secret for Helix app tokens). These are separate from the normal Twitch OAuth application's credentials. Never put them in browser configuration. Set `EXTENSION_BACKEND_URL` to the public HTTPS backend origin before building the Extension.
4. Set `PAYMENTS_DB_PATH` to persistent, non-public local storage, normally `.data/payments.sqlite`. Preserve the database, WAL and SHM files; do not reset it between streams. To copy a backup, stop the server cleanly and back up the directory before restarting. The lock file prevents two processes opening the ledger. Startup fails if enabled payments lack required configuration; there is no silent free fallback.
5. Set `PAID_DEPLOYMENTS_ENABLED=true`, restart the server, reconnect a real channel and start a live battle. This switches non-broadcaster deployments to Bits-only across native cards, the web command endpoint and Twitch chat deployment aliases. The broadcaster's verified identity retains free host deployment using team energy. Room ownership or moderator role alone does not bypass the gate.
6. Follow Twitch Local/Hosted Test and review procedures before release. Development/loopback transactions never authorize deployments in a live paid match; the backend requires a matching non-development Helix transaction. Automated tests use explicitly labeled fake Twitch services and temporary ledgers. A reviewed live Extension, eligible broadcaster, controlled real transaction, correct fulfillment and actual payout reporting remain external acceptance steps. They have not been verified by this implementation.

Sources: [monetization setup](https://dev.twitch.tv/docs/extensions/monetization/), [Extension helper and receipt reference](https://dev.twitch.tv/docs/extensions/reference/), [authoritative Extension transactions](https://dev.twitch.tv/docs/api/reference/#get-extension-transactions), [Extension policies](https://dev.twitch.tv/docs/extensions/guidelines-and-policies/).

## Viewer flow and recovery

The native frontend checks `isBitsEnabled` and matches Twitch's catalog amount to the configured SKU. It first obtains a server reservation, then opens Twitch's native confirmation. No soldier is spawned by a browser callback. A signed receipt is verified for signature, type, expiry and viewer identity; Helix independently confirms the transaction ID, Extension domain, broadcaster, viewer, product, amount, non-development status and reservation time window. A changed amount is retained for host review rather than automatically fulfilled. A normal web watch page directs paid viewers to the native Extension on the broadcaster's Twitch channel; it never imitates a Bits checkout.

Each transaction ID is unique in SQLite. Confirmed actions enter a separate reinforcement queue and do not subtract team energy. Their original channel determines the team; clients cannot choose the team in receipt requests. A paused match, command pause, full battlefield, disconnected channel or completed battle delays delivery. The next uniquely connected live battle on the same channel can deliver the queued soldier. Two live matches connected to the same channel are ambiguous, so fulfillment waits until only one remains.

New activations close 15 seconds before the battle ends. New reservations are limited to 100 outstanding activations per channel and five per viewer, including recent confirmation holds. Only one confirmation may be active per viewer for three minutes; cancellation can leave that short hold until it expires. Genuine confirmations arriving later (for example after a viewer obtains more Bits) are still honored rather than rejected because the hold expired. Late confirmations can exceed the reservation limits; the delivery rate and game entity cap still apply. A distinct verified transaction that reuses an already-confirmed intent is retained for broadcaster review. Confirmed entitlements do not expire merely because a room ended. A maximum of one queued soldier per channel is delivered every 500 ms.

Missed callbacks are reconciled from Twitch's transaction list every 15 seconds, one page of at most 100 transactions per interval, alternating newest and backlog pages. Automatic matching considers up to 500 reservations from the last 24 hours. The viewer can also retry verification by transaction ID; bounded browser recovery stores only the intent and transaction IDs, never JWTs or access tokens. Successful delivery and retry are idempotent. Network failures retain the reservation; failed background verification closes new activations until a successful sync. Existing verified actions can still be delivered.

The ledger is capped at 100,000 records, closing new reservations when capacity is reached. It does not silently prune financial history. Viewer history shows their own latest records; only the authorized broadcaster sees channel-wide records. No signed receipts, OAuth tokens, signing secrets or client secrets are stored in transaction rows or exposed in snapshots.

## Host controls and crash behavior

The live operator dashboard has a Bits deployments panel with prices, accepting/closed controls and recent fulfillment records for channels authenticated by that operator. A second broadcaster manages its own channel through the broadcaster view of the native Extension. Room ownership by itself cannot administer the other channel's transactions. New-activation settings persist per channel. Stopping new activations does not discard already confirmed actions.

States are `confirming → queued → dispatching → fulfilled`, with `review` for uncertain dispatch or price discrepancies. The ledger records a dispatch marker before mutating the game, then records its room/entity IDs on completion. If a process stops during dispatch, startup moves that record to review. An authenticated broadcaster must inspect the outcome and supply a resolution note before marking it delivered or requeuing it; resolutions are audited. Requeuing an already delivered action can create a second soldier, so the UI explicitly requires inspection.

This is not an atomic transaction across SQLite and the in-memory simulation. Battle checkpoints and room/auth sessions are still not persisted, and completed actions are not replayed after restart. Interrupted deliveries are not automatically repeated, and the system does not promise crash-proof exactly-once game execution. Queued entitlements and completed transaction IDs do survive restart. A crash after completion still terminates the in-memory match. These operational limits must be accepted before public paid use. Refunds are not automatically issued or promised; follow Twitch's applicable support and refund process.

## Verification

The automated payment tests cover signed and forged receipts, wrong channels/viewers/domains/products, development transactions, price discrepancies, duplicate fulfillment, zero team energy, missed callbacks, pause/capacity/results carryover, restart review, database locking, cutoff/cooldowns, origin/role authorization and free-command bypasses. Browser tests drive the real Extension source through a real Fastify API and temporary SQLite ledger using fake Twitch responses, including confirmation, cancellation and unavailable Bits. `docs/screenshots/paid-deployment-fixture.png` is labeled as a test with no real Bits.

Implementation verification: TypeScript, ESLint and formatting checks passed; both the production app and native Extension built successfully; all 161 tests across 31 test files passed; and eight browser tests passed across paid actions, existing player controls and streaming layout. The running local health endpoint reported `payments: "disabled"`. The local Extension client ID, signing secret and OAuth client secret were absent. No real Bits were used, no native Extension was published, and no live monetization approval or payout was verified. Existing upstream Zod annotation/large-bundle warnings, Fastify deprecation output and Node's SQLite experimental warning remain nonfatal.
