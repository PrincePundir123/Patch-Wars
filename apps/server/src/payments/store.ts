import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, openSync, writeFileSync, closeSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DeploymentRecord, SOLDIER_PRODUCTS } from '../../../../packages/shared/src/payments.js';

export class PaymentStore {
  private db: DatabaseSync;
  private lock?: string;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    if (path !== ':memory:') {
      this.lock = resolve(path) + '.lock';
      try {
        const previous = Number(readFileSync(this.lock, 'utf8'));
        if (Number.isInteger(previous) && previous > 0) {
          try {
            process.kill(previous, 0);
            throw new Error('Payment database is already in use.');
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
          }
        } else throw new Error('Payment database lock needs operator inspection.');
        unlinkSync(this.lock);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const descriptor = openSync(this.lock, 'wx', 0o600);
      try {
        writeFileSync(descriptor, String(process.pid));
      } finally {
        closeSync(descriptor);
      }
    }
    try {
      this.db = new DatabaseSync(path);
    } catch (error) {
      if (this.lock) unlinkSync(this.lock);
      throw error;
    }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY, channelId TEXT NOT NULL, userId TEXT NOT NULL,
        sku TEXT NOT NULL, unitId TEXT NOT NULL, bits INTEGER NOT NULL,
        status TEXT NOT NULL, transactionId TEXT UNIQUE, createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL, roomId TEXT NOT NULL, entityId INTEGER, note TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS deployment_channel ON deployments(channelId, status);
      CREATE TABLE IF NOT EXISTS payment_channels (id TEXT PRIMARY KEY, accepting INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS payment_audit (id INTEGER PRIMARY KEY, deploymentId TEXT NOT NULL,
        at INTEGER NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL, note TEXT NOT NULL);`);
    // A crash between spawning and recording completion has an ambiguous outcome.
    // Never replay it automatically: an authenticated operator must resolve it.
    this.db
      .prepare(
        "UPDATE deployments SET status='review', note='Server stopped during delivery; operator review required.' WHERE status='dispatching'",
      )
      .run();
  }
  close() {
    this.db.close();
    if (this.lock) unlinkSync(this.lock);
  }
  get(id: string) {
    const row = this.db.prepare('SELECT * FROM deployments WHERE id=?').get(id);
    return row ? DeploymentRecord.parse(row) : undefined;
  }
  transaction(id: string) {
    const row = this.db.prepare('SELECT * FROM deployments WHERE transactionId=?').get(id);
    return row ? DeploymentRecord.parse(row) : undefined;
  }
  records(channelId: string, userId?: string) {
    const rows = userId
      ? this.db
          .prepare(
            'SELECT * FROM deployments WHERE channelId=? AND userId=? ORDER BY createdAt DESC LIMIT 50',
          )
          .all(channelId, userId)
      : this.db
          .prepare('SELECT * FROM deployments WHERE channelId=? ORDER BY createdAt DESC LIMIT 50')
          .all(channelId);
    return rows.map((row) => DeploymentRecord.parse(row));
  }
  queued(channelId: string) {
    return this.db
      .prepare(
        "SELECT * FROM deployments WHERE channelId=? AND status='queued' ORDER BY createdAt LIMIT 10",
      )
      .all(channelId)
      .map((row) => DeploymentRecord.parse(row));
  }
  pending() {
    return this.db
      .prepare(
        "SELECT * FROM deployments WHERE status='confirming' AND createdAt>? ORDER BY createdAt DESC LIMIT 500",
      )
      .all(Date.now() - 86400000)
      .map((row) => DeploymentRecord.parse(row));
  }
  accepting(channelId: string) {
    return (
      this.db.prepare('SELECT accepting FROM payment_channels WHERE id=?').get(channelId)
        ?.accepting !== 0
    );
  }
  setAccepting(channelId: string, accepting: boolean) {
    this.db
      .prepare(
        'INSERT INTO payment_channels VALUES (?,?) ON CONFLICT(id) DO UPDATE SET accepting=excluded.accepting',
      )
      .run(channelId, Number(accepting));
  }
  reserve(
    channelId: string,
    userId: string,
    roomId: string,
    product: (typeof SOLDIER_PRODUCTS)[number],
    now = Date.now(),
  ) {
    if (Number(this.db.prepare('SELECT COUNT(*) AS n FROM deployments').get()!.n) >= 100000)
      throw new Error('Payment ledger capacity reached. New activations are closed.');
    // One process owns this ledger. Synchronous calls are serialized before any network work.
    const count = this.db
      .prepare(
        "SELECT COUNT(*) AS n FROM deployments WHERE channelId=? AND (status IN ('queued','dispatching','review') OR (status='confirming' AND createdAt>?))",
      )
      .get(channelId, now - 180000)!;
    if (Number(count.n) >= 100) throw new Error('The reinforcement queue is full. Try later.');
    const active = this.db
      .prepare(
        "SELECT COUNT(*) AS n FROM deployments WHERE channelId=? AND userId=? AND (status IN ('queued','dispatching','review') OR (status='confirming' AND createdAt>?))",
      )
      .get(channelId, userId, now - 180000)!;
    if (Number(active.n) >= 5) throw new Error('You already have five pending activations.');
    const recent = this.db
      .prepare(
        'SELECT createdAt FROM deployments WHERE channelId=? AND userId=? ORDER BY createdAt DESC LIMIT 1',
      )
      .get(channelId, userId);
    if (recent && now - Number(recent.createdAt) < 1500)
      throw new Error('Activation cooldown. Try again shortly.');
    const existing = this.db
      .prepare(
        "SELECT id FROM deployments WHERE channelId=? AND userId=? AND status='confirming' AND createdAt>?",
      )
      .get(channelId, userId, now - 180000);
    if (existing)
      throw new Error('Finish or wait for your previous confirmation before starting another.');
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO deployments VALUES (?,?,?,?,?,?,'confirming',NULL,?,?,?,NULL,?)")
      .run(
        id,
        channelId,
        userId,
        product.sku,
        product.unitId,
        product.bits,
        now,
        now,
        roomId,
        'Awaiting Twitch confirmation.',
      );
    return this.get(id)!;
  }
  confirm(id: string, transactionId: string, bits: number, reviewNote?: string) {
    const existing = this.transaction(transactionId);
    if (existing) return existing;
    this.db
      .prepare(
        "UPDATE deployments SET transactionId=?, bits=?, status=?, updatedAt=?, note=? WHERE id=? AND status='confirming'",
      )
      .run(
        transactionId,
        bits,
        reviewNote ? 'review' : 'queued',
        Date.now(),
        reviewNote ?? 'Verified. Queued for this channel’s next available battle.',
        id,
      );
    return this.get(id)!;
  }
  additionalReview(intent: DeploymentRecord, transactionId: string, bits: number) {
    const existing = this.transaction(transactionId);
    if (existing) return existing;
    const id = randomUUID(),
      now = Date.now();
    // A distinct genuine Twitch transaction must not disappear merely because
    // a client reused its intent. Preserve it for broadcaster inspection.
    this.db
      .prepare("INSERT INTO deployments VALUES (?,?,?,?,?,?,'review',?,?,?,?,NULL,?)")
      .run(
        id,
        intent.channelId,
        intent.userId,
        intent.sku,
        intent.unitId,
        bits,
        transactionId,
        now,
        now,
        intent.roomId,
        'An additional verified transaction reused an activation. Inspect before fulfilling.',
      );
    return this.get(id)!;
  }
  transition(
    id: string,
    from: DeploymentRecord['status'],
    status: DeploymentRecord['status'],
    note: string,
    roomId?: string,
    entityId: number | null = null,
  ) {
    return (
      this.db
        .prepare(
          'UPDATE deployments SET status=?, note=?, updatedAt=?, roomId=COALESCE(?,roomId), entityId=? WHERE id=? AND status=?',
        )
        .run(status, note, Date.now(), roomId ?? null, entityId, id, from).changes === 1
    );
  }
  resolve(id: string, action: 'requeue' | 'fulfilled', actor: string, note: string) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (!this.transition(id, 'review', action === 'requeue' ? 'queued' : 'fulfilled', note))
        throw new Error('Only deliveries needing review can be resolved.');
      this.db
        .prepare('INSERT INTO payment_audit(deploymentId,at,action,actor,note) VALUES (?,?,?,?,?)')
        .run(id, Date.now(), action, actor, note);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
