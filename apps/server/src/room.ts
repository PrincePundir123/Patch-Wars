import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createGame,
  startGame,
  step,
  spawn,
  MAX_ENTITIES,
} from '../../../packages/game-core/src/index.js';
import {
  type Team,
  type Snapshot,
  type Proposal,
  type ForgeJob,
  type Blueprint,
  type BalanceReport,
} from '../../../packages/shared/src/index.js';
import {
  Deduplicator,
  RateGate,
  parseCommand,
  normalizeChat,
  type ChatMessage,
} from '../../../packages/twitch-adapter/src/index.js';
import { moderate, validateBlueprint } from '../../forge-worker/src/pipeline.js';
export class Room {
  readonly id = randomUUID();
  game = createGame(2026, 90);
  paused = false;
  seq = 0;
  roundPhase: Snapshot['roundPhase'] = 'proposals';
  roundEndsAtTick = 240;
  proposals: Proposal[] = [];
  forge: ForgeJob | null = null;
  timeline: Snapshot['timeline'] = [];
  commandFeedback: Snapshot['commandFeedback'] = [];
  private feedbackCounter = 0;
  channels: Snapshot['channels'] = [];
  sharedChat = false;
  commandsEnabled = true;
  forgeEnabled = true;
  teamNames = { ember: 'Ember', azure: 'Azure' };
  lastAccess = Date.now();
  private voters = new Map<string, string>();
  private proposalAuthors = new Set<string>();
  private joined = new Set<string>();
  private dedupe = new Deduplicator();
  private gates = new RateGate();
  private proposalCounter = 0;
  private eventCounter = 0;
  private worker: Worker | undefined;
  private jobTimer: ReturnType<typeof setTimeout> | undefined;
  private generationTimes: number[] = [];
  private generationCount = 0;
  private pending: { blueprint: Blueprint; report: BalanceReport; team: Team } | null = null;
  private winningTeam: Team = 'ember';
  private demoMessage = 0;
  private sharedSessions = new Map<string, { timestamp: number; active: boolean }>();
  constructor(
    public owner: string,
    public mode: 'demo' | 'live',
    public provider = 'fixture',
    public maxJobs = 12,
    public timeout = 90000,
  ) {
    if (mode === 'live') {
      this.game = createGame(2026, 180);
      this.roundEndsAtTick = 1200;
    }
    this.note(
      mode === 'demo'
        ? 'Replay ready. Twitch events and Forge output are fixtures.'
        : 'Match ready. Connect a Twitch channel to begin.',
    );
  }
  snapshot(): Snapshot {
    return {
      type: 'snapshot',
      seq: ++this.seq,
      roomId: this.id,
      mode: this.mode,
      paused: this.paused,
      game: this.game,
      proposals: this.proposals,
      forge: this.forge,
      roundPhase: this.roundPhase,
      roundEndsAtTick: this.roundEndsAtTick,
      timeline: this.timeline,
      channels: this.channels,
      sharedChat: this.sharedChat,
      commandsEnabled: this.commandsEnabled,
      forgeEnabled: this.forgeEnabled,
      teamNames: this.teamNames,
      provider: this.provider,
      commandFeedback: this.commandFeedback,
    };
  }
  note(text: string) {
    this.timeline.unshift({ id: ++this.eventCounter, text, tick: this.game.tick });
    this.timeline = this.timeline.slice(0, 30);
  }
  start() {
    if (this.mode === 'live' && !this.channels.some((c) => c.status.startsWith('connected')))
      throw new Error('Connect Twitch before starting a live match.');
    startGame(this.game);
    this.note('The gates are open. Let the battle begin.');
  }
  reset() {
    this.dispose();
    this.game = createGame(this.game.seed, this.game.durationTicks / 20);
    this.paused = false;
    this.forge = null;
    this.pending = null;
    this.proposals = [];
    this.voters.clear();
    this.proposalAuthors.clear();
    this.joined.clear();
    this.dedupe = new Deduplicator();
    this.gates = new RateGate();
    this.proposalCounter = 0;
    this.demoMessage = 0;
    this.roundPhase = 'proposals';
    this.roundEndsAtTick = this.mode === 'demo' ? 240 : 1200;
    this.timeline = [];
    this.commandFeedback = [];
    this.eventCounter = 0;
    this.note('Battle reset to seed ' + this.game.seed);
  }
  tick() {
    if (this.paused || this.game.phase !== 'battle') return;
    if (
      this.mode === 'demo' &&
      this.game.tick === 539 &&
      this.forge &&
      ['generating', 'validating', 'simulating'].includes(this.forge.status)
    )
      return;
    step(this.game);
    if (this.mode === 'demo') this.replay();
    if (this.pending && this.game.tick >= (this.forge?.deploymentTick ?? 540)) this.deploy();
    if ((this.game.phase as string) === 'results') {
      this.cancelJob();
      this.note(
        this.game.winner === 'draw'
          ? 'The battle ends in a draw.'
          : `${this.teamNames[this.game.winner!]} wins the battle.`,
      );
      return;
    }
    if (this.forgeEnabled && this.game.tick >= this.roundEndsAtTick) {
      if (this.roundPhase === 'proposals') this.openVote();
      else if (this.roundPhase === 'voting') this.launchForge();
      else if (!this.worker && !this.pending) {
        this.proposals = [];
        this.voters.clear();
        this.proposalAuthors.clear();
        this.roundPhase = 'proposals';
        this.roundEndsAtTick = this.game.tick + 1200;
      }
    }
  }
  receive(raw: unknown) {
    let message: ChatMessage;
    try {
      message = normalizeChat(raw);
    } catch {
      return 'Invalid chat event.';
    }
    const channel = this.channels.find((c) => c.id === message.channelId);
    if (!channel) return 'Channel is not participating.';
    return this.command(message, channel.team);
  }
  command(m: ChatMessage, team: Team) {
    if (!parseCommand(m.text)) return 'Unknown command or invalid arguments.';
    const before = this.game.nextId;
    const message = this.applyCommand(m, team);
    if (message !== 'Duplicate event ignored.') {
      this.commandFeedback.unshift({
        id: ++this.feedbackCounter,
        team,
        command: parseCommand(m.text)!.command,
        message,
        tick: this.game.tick,
        ...(this.game.nextId > before ? { entityId: before } : {}),
      });
      this.commandFeedback = this.commandFeedback.slice(0, 8);
    }
    return message;
  }
  private applyCommand(m: ChatMessage, team: Team) {
    if (!this.dedupe.accept(m.id)) return 'Duplicate event ignored.';
    if (!this.commandsEnabled) return 'Chat commands are paused.';
    const parsed = parseCommand(m.text);
    if (!parsed) return 'Unknown command or invalid arguments.';
    const now = this.mode === 'demo' ? this.game.tick * 50 : Date.now();
    if (
      !this.gates.allow('global', 100, 1000, now) ||
      !this.gates.allow(`channel:${m.channelId}`, 50, 1000, now) ||
      !this.gates.allow(`user:${m.userId}`, 1, 1500, now)
    )
      return 'Command cooldown. Try again shortly.';
    const { command, argument } = parsed;
    if (command === 'help')
      return '!join Â· !spawn guardian Â· !attack Â· !defend Â· !forge idea Â· !vote p1 Â· !units Â· !score';
    if (command === 'score')
      return `Ember ${this.game.scores.ember} / Azure ${this.game.scores.azure}`;
    if (command === 'units')
      return Object.values(this.game.catalog)
        .map((b) => `${b.id} (${b.stats.spawnCost})`)
        .join(', ')
        .slice(0, 400);
    if (command === 'join') {
      if (this.joined.size >= 20000) return 'Participation capacity reached.';
      this.joined.add(m.userId);
      return `Joined ${this.teamNames[team]}. Use !spawn to enter the battle.`;
    }
    if (this.game.phase === 'results') return 'Battle ended. Reset and start a new battle.';
    if (this.game.phase !== 'battle') return 'Start the battle first.';
    if (this.paused) return 'Battle paused. Resume the battle first.';
    if (command === 'forge') {
      if (!this.forgeEnabled || this.roundPhase !== 'proposals') return 'Proposals are closed.';
      if (this.proposals.length >= 6 || this.proposalAuthors.has(m.userId))
        return 'One proposal per viewer; six proposals per round.';
      let idea: string;
      try {
        idea = moderate(argument);
      } catch {
        return 'Idea rejected by safety filter.';
      }
      if (this.proposals.some((p) => p.idea.toLowerCase() === idea.toLowerCase()))
        return 'That idea is already in the forge.';
      const p = { id: `p${++this.proposalCounter}`, idea, author: 'Viewer', team, votes: 0 };
      this.proposals.push(p);
      this.proposalAuthors.add(m.userId);
      this.note(`${this.teamNames[team]} proposed: ${idea}`);
      return `Proposal ${p.id} accepted.`;
    }
    if (command === 'vote') {
      if (this.roundPhase !== 'voting') return 'Voting is closed.';
      const p = this.proposals.find((p) => p.id === argument);
      if (!p) return 'Proposal not found.';
      if (this.voters.size >= 20000) return 'Voting capacity reached.';
      const previous = this.voters.get(m.userId);
      if (previous === p.id) return 'Your vote is already counted.';
      if (previous) {
        const old = this.proposals.find((p) => p.id === previous);
        if (old) old.votes--;
      }
      p.votes++;
      this.voters.set(m.userId, p.id);
      return `Vote counted for ${p.id}.`;
    }
    const id =
      command === 'attack'
        ? 'sprinter'
        : command === 'defend'
          ? 'guardian'
          : argument || 'guardian';
    if (!spawn(this.game, team, id))
      return 'Spawn unavailable: check energy, unit ID or entity cap.';
    this.note(`${this.teamNames[team]} deployed ${this.game.catalog[id]!.name}.`);
    return `${this.game.catalog[id]!.name} deployed.`;
  }
  demoCommand(text: string, team: Team, userId = `demo-user-${++this.demoMessage}`) {
    return this.command(
      { id: `demo:${++this.demoMessage}`, channelId: team, userId, name: 'Replay viewer', text },
      team,
    );
  }
  openVote() {
    if (!this.forgeEnabled || this.game.phase !== 'battle' || this.roundPhase !== 'proposals')
      return;
    this.roundPhase = 'voting';
    this.roundEndsAtTick = this.game.tick + (this.mode === 'demo' ? 200 : 400);
    this.note('Voting is open. One effective vote per viewer.');
  }
  launchForge() {
    if (
      !this.forgeEnabled ||
      this.game.phase !== 'battle' ||
      this.worker ||
      this.roundPhase !== 'voting'
    )
      return;
    this.roundPhase = 'processing';
    this.roundEndsAtTick = this.game.tick + 400;
    const winner = [...this.proposals].sort(
      (a, b) => b.votes - a.votes || Number(a.id.slice(1)) - Number(b.id.slice(1)),
    )[0];
    if (!winner) {
      this.note('No proposals this round.');
      return;
    }
    this.forge = {
      id: randomUUID(),
      status: 'generating',
      provider: this.provider,
      idea: winner.idea,
      steps: [],
      attempts: 0,
    };
    const now = Date.now();
    this.generationTimes = this.generationTimes.filter((t) => now - t < 3600000);
    if (this.generationTimes.length >= this.maxJobs || this.generationCount >= 12) {
      this.updateForge('rejected', 'Forge quota reached.');
      return;
    }
    this.generationTimes.push(now);
    this.generationCount++;
    this.winningTeam = winner.team;
    this.updateForge('generating');
    const jobId = this.forge.id;
    const allowedEnv = Object.fromEntries(
      ['PATH', 'SYSTEMROOT', 'OPENAI_API_KEY', 'FORGE_MODEL', 'CODEX_ISOLATED'].flatMap((k) =>
        process.env[k] ? [[k, process.env[k]!]] : [],
      ),
    );
    const worker = new Worker(resolve('dist/forge/worker.js'), {
      workerData: { idea: winner.idea, provider: this.provider, timeout: this.timeout },
      env: allowedEnv,
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    this.worker = worker;
    this.jobTimer = setTimeout(() => {
      this.updateForge('rejected', 'Forge timed out. Battle continues.');
      this.cancelJob();
    }, this.timeout + 1000);
    worker.on(
      'message',
      (m: {
        status: string;
        error?: string;
        blueprint?: unknown;
        report?: BalanceReport;
        attempt?: number;
      }) => {
        if (this.forge?.id !== jobId || this.worker !== worker) return;
        if (m.attempt) this.forge.attempts = m.attempt;
        if (m.status === 'approved') {
          try {
            const b = validateBlueprint(m.blueprint);
            if (!m.report?.passed) throw new Error('Missing balance approval.');
            this.pending = { blueprint: b, report: m.report, team: this.winningTeam };
            this.forge.blueprint = b;
            this.forge.report = m.report;
            this.forge.name = b.name;
            this.forge.deploymentTick = this.mode === 'demo' ? 540 : this.game.tick + 60;
            this.updateForge('approved');
          } catch {
            this.updateForge('rejected', 'Worker output failed final validation.');
          }
          this.cancelJob();
        } else if (m.status === 'rejected') {
          this.updateForge('rejected', m.error ?? 'Forge failed.');
          this.cancelJob();
        } else if (['generating', 'validating', 'simulating'].includes(m.status))
          this.updateForge(m.status as ForgeJob['status']);
      },
    );
    worker.on('error', () => {
      if (this.forge?.id === jobId && this.worker === worker) {
        this.updateForge('rejected', 'Forge worker unavailable. Build the worker and retry.');
        this.cancelJob();
      }
    });
    worker.on('exit', (code) => {
      if (this.worker === worker && this.forge?.id === jobId && code !== 0) {
        this.updateForge('rejected', 'Forge worker stopped unexpectedly.');
        this.cancelJob();
      }
    });
  }
  private updateForge(status: ForgeJob['status'], error?: string) {
    if (!this.forge) return;
    this.forge.status = status;
    this.forge.steps.push({ status, at: Date.now() });
    if (error) {
      this.forge.error = error;
      this.note(error);
    }
  }
  private deploy() {
    const p = this.pending;
    if (!p) return;
    // Keep the approved job queued until the live entity budget has room.
    // Never announce deployment when both spawn attempts would be rejected.
    if (this.game.units.length >= MAX_ENTITIES) return;
    const id = `forged-${this.game.tick}`;
    const b = { ...p.blueprint, id };
    this.game.catalog[id] = b;
    spawn(this.game, p.team, id, true);
    spawn(this.game, p.team, id, true);
    if (this.forge) this.forge.blueprint = b;
    this.updateForge('deployed');
    this.note(`${b.name} is live. ${p.blueprint.abilities.map((a) => a.op).join(' + ')} unlocked.`);
    this.pending = null;
  }
  raid(team: Team, viewers: number, eventId: string) {
    if (!this.dedupe.accept(`raid:${eventId}`) || this.game.phase !== 'battle') return;
    const count = Math.min(8, Math.max(1, Math.floor(Math.log2(Math.max(1, viewers))) + 1));
    for (let i = 0; i < count; i++) spawn(this.game, team, i % 2 ? 'guardian' : 'sprinter', true);
    this.note(
      `${this.mode === 'demo' ? 'Simulated raid' : 'Raid'}: ${count} reinforcements for ${this.teamNames[team]}.`,
    );
  }
  shared(type: string, session: string, timestamp: number) {
    const old = this.sharedSessions.get(session);
    if (old && old.timestamp >= timestamp) return;
    this.sharedSessions.set(session, { timestamp, active: type !== 'channel.shared_chat.end' });
    this.sharedChat = [...this.sharedSessions.values()].some((s) => s.active);
    if (this.sharedSessions.size > 100)
      this.sharedSessions.delete(this.sharedSessions.keys().next().value!);
  }
  private replay() {
    const t = this.game.tick;
    if (t === 40)
      this.demoCommand('!forge a slime that splits into three when defeated', 'ember', 'replay-1');
    if (t === 100)
      this.demoCommand('!forge a frost ranger that slows enemies', 'azure', 'replay-2');
    if (t === 160) this.demoCommand('!forge a medic that heals nearby allies', 'ember', 'replay-3');
    if (t >= 260 && t <= 380 && t % 20 === 0)
      this.demoCommand(
        `!vote ${t === 300 ? 'p2' : 'p1'}`,
        t % 40 === 0 ? 'ember' : 'azure',
        `replay-voter-${t}`,
      );
    if (t === 900) this.raid('azure', 50, 'scripted-raid');
    if (t === 700) this.demoCommand('!attack', 'azure', 'replay-counter');
  }
  private cancelJob() {
    clearTimeout(this.jobTimer);
    if (this.worker) {
      void this.worker.terminate();
      this.worker = undefined;
    }
  }
  dispose() {
    this.cancelJob();
  }
}
