import { z } from 'zod';
export const TeamSchema = z.enum(['ember', 'azure']);
export type Team = z.infer<typeof TeamSchema>;
export const TEAMS: Team[] = ['ember', 'azure'];
export const safeText = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[\p{L}\p{N} .,!'?()-]+$/u);
export const AbilitySchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('shield'),
      event: z.literal('spawn'),
      amount: z.number().int().min(1).max(50),
    })
    .strict(),
  z
    .object({
      op: z.literal('slow'),
      event: z.literal('hit'),
      duration: z.number().int().min(1).max(60),
    })
    .strict(),
  z
    .object({
      op: z.literal('splash'),
      event: z.literal('attack'),
      amount: z.number().int().min(1).max(12),
      radius: z.number().min(10).max(90),
      every: z.number().int().min(2).max(8),
    })
    .strict(),
  z
    .object({
      op: z.literal('heal'),
      event: z.literal('tick'),
      amount: z.number().int().min(1).max(12),
      radius: z.number().min(20).max(140),
      every: z.number().int().min(20).max(100),
    })
    .strict(),
  z
    .object({
      op: z.literal('split'),
      event: z.literal('death'),
      count: z.number().int().min(1).max(3),
      scale: z.number().min(0.15).max(0.4),
    })
    .strict(),
]);
export const BlueprintSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
    name: safeText.max(32),
    description: safeText,
    archetype: z.enum(['tank', 'ranged', 'support', 'assassin', 'summoner']),
    stats: z
      .object({
        maxHealth: z.number().int().min(20).max(200),
        attackDamage: z.number().int().min(2).max(25),
        attackRange: z.number().min(18).max(160),
        attackCooldownTicks: z.number().int().min(10).max(60),
        moveSpeed: z.number().min(0.5).max(3),
        spawnCost: z.number().int().min(2).max(10),
      })
      .strict(),
    appearance: z
      .object({
        shape: z.enum(['shield', 'arrow', 'diamond', 'cross', 'orb', 'slime']),
        palette: z.enum(['team', 'violet', 'lime', 'gold']),
        effectPreset: z.enum(['spark', 'frost', 'bloom']),
      })
      .strict(),
    abilities: z.array(AbilitySchema).max(3),
    weaknesses: z.array(safeText.max(80)).min(1).max(3),
    sourcePrompt: safeText.max(180),
  })
  .strict();
export type Blueprint = z.infer<typeof BlueprintSchema>;
export type Ability = z.infer<typeof AbilitySchema>;
export type Entity = {
  id: number;
  blueprintId: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  cooldown: number;
  slowUntil: number;
  attacks: number;
  child: boolean;
  born: number;
};
export type BattleEvent = {
  id: number;
  tick: number;
  kind: 'spawn' | 'attack' | 'death' | 'split' | 'heal' | 'base' | 'raid';
  team: Team;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  amount?: number;
};
export type GameState = {
  tick: number;
  seed: number;
  rng: number;
  nextId: number;
  durationTicks: number;
  phase: 'lobby' | 'battle' | 'results';
  winner: Team | 'draw' | null;
  units: Entity[];
  bases: Record<Team, number>;
  scores: Record<Team, number>;
  energy: Record<Team, number>;
  damage: Record<Team, number>;
  events: BattleEvent[];
  nextEvent: number;
  catalog: Record<string, Blueprint>;
  spawned: number;
  peakEntities: number;
};
export type Proposal = { id: string; idea: string; author: string; team: Team; votes: number };
export type BalanceReport = {
  engagements: number;
  winRate: number;
  passed: boolean;
  durationMs: number;
  peakEntities: number;
  damageDealt: number;
  damageReceived: number;
  meanLifespanTicks: number;
  efficiency: number;
};
export type ForgeStatus =
  | 'idle'
  | 'proposals'
  | 'voting'
  | 'generating'
  | 'validating'
  | 'simulating'
  | 'approved'
  | 'deployed'
  | 'rejected';
export type ForgeJob = {
  id: string;
  status: ForgeStatus;
  provider: string;
  idea: string;
  name?: string;
  blueprint?: Blueprint;
  report?: BalanceReport;
  error?: string;
  steps: { status: string; at: number }[];
  attempts: number;
  deploymentTick?: number;
};
export type Snapshot = {
  type: 'snapshot';
  seq: number;
  roomId: string;
  mode: 'demo' | 'live';
  paused: boolean;
  game: GameState;
  proposals: Proposal[];
  forge: ForgeJob | null;
  roundPhase: 'proposals' | 'voting' | 'processing';
  roundEndsAtTick: number;
  timeline: { id: number; text: string; tick: number }[];
  channels: { id: string; name: string; team: Team; status: string }[];
  sharedChat: boolean;
  commandsEnabled: boolean;
  forgeEnabled: boolean;
  teamNames: Record<Team, string>;
  provider: string;
  commandFeedback: {
    id: number;
    team: Team;
    command: string;
    message: string;
    tick: number;
    entityId?: number;
  }[];
};
export const CommandSchema = z
  .object({ text: z.string().min(1).max(220), team: TeamSchema })
  .strict();
export const ControlSchema = z.discriminatedUnion('action', [
  z
    .object({ action: z.enum(['start', 'pause', 'resume', 'reset', 'vote', 'forge', 'raid']) })
    .strict(),
  z
    .object({
      action: z.literal('settings'),
      commandsEnabled: z.boolean(),
      forgeEnabled: z.boolean(),
      duration: z.number().int().min(60).max(900),
      ember: safeText.max(24),
      azure: safeText.max(24),
    })
    .strict(),
  z.object({ action: z.literal('reject'), proposalId: z.string().max(40) }).strict(),
]);
