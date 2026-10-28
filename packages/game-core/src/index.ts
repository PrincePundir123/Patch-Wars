import {
  type Blueprint,
  type Entity,
  type GameState,
  type Team,
  type BattleEvent,
  TEAMS,
} from '../../shared/src/index.js';
export const TICK_RATE = 20,
  MAX_ENTITIES = 160;
const unit = (
  id: string,
  name: string,
  archetype: Blueprint['archetype'],
  shape: Blueprint['appearance']['shape'],
  hp: number,
  damage: number,
  range: number,
  speed: number,
  cost: number,
  abilities: Blueprint['abilities'] = [],
): Blueprint => ({
  schemaVersion: 1,
  id,
  name,
  archetype,
  description: `${name} joins the battlefield.`,
  stats: {
    maxHealth: hp,
    attackDamage: damage,
    attackRange: range,
    attackCooldownTicks: 20,
    moveSpeed: speed,
    spawnCost: cost,
  },
  appearance: { shape, palette: 'team', effectPreset: 'spark' },
  abilities,
  weaknesses: ['Vulnerable when isolated.'],
  sourcePrompt: 'Starter roster',
});
export const STARTERS: Blueprint[] = [
  unit('guardian', 'Guardian', 'tank', 'shield', 160, 10, 24, 0.8, 5),
  unit('archer', 'Archer', 'ranged', 'arrow', 65, 12, 130, 1, 4),
  unit('sprinter', 'Sprinter', 'assassin', 'diamond', 50, 9, 24, 2.6, 3),
  unit('healer', 'Healer', 'support', 'cross', 70, 4, 65, 1, 4, [
    { op: 'heal', event: 'tick', amount: 8, radius: 100, every: 30 },
  ]),
  unit('bomber', 'Bomber', 'ranged', 'orb', 60, 10, 85, 1.2, 5, [
    { op: 'splash', event: 'attack', amount: 9, radius: 65, every: 2 },
  ]),
];
export const SLIME: Blueprint = {
  ...unit('prism-slime', 'Prism Slime', 'summoner', 'slime', 95, 8, 26, 1.3, 5, [
    { op: 'split', event: 'death', count: 3, scale: 0.3 },
  ]),
  description: 'One falls. Three rise. Splits into three smaller slimes on defeat.',
  appearance: { shape: 'slime', palette: 'lime', effectPreset: 'bloom' },
  weaknesses: ['Fragile children are vulnerable to area damage.'],
  sourcePrompt: 'A slime that splits into three when defeated',
};
export function createGame(seed = 2026, duration = 180): GameState {
  return {
    tick: 0,
    seed,
    rng: seed >>> 0 || 1,
    nextId: 1,
    durationTicks: duration * TICK_RATE,
    phase: 'lobby',
    winner: null,
    units: [],
    bases: { ember: 1000, azure: 1000 },
    scores: { ember: 0, azure: 0 },
    energy: { ember: 30, azure: 30 },
    damage: { ember: 0, azure: 0 },
    events: [],
    nextEvent: 1,
    catalog: Object.fromEntries(STARTERS.map((b) => [b.id, b])),
    spawned: 0,
    peakEntities: 0,
  };
}
export function random(s: GameState) {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
export const other = (t: Team): Team => (t === 'ember' ? 'azure' : 'ember');
function event(s: GameState, e: Omit<BattleEvent, 'id' | 'tick'>) {
  s.events.push({ ...e, id: s.nextEvent++, tick: s.tick });
  if (s.events.length > 100) s.events.shift();
}
export function spawn(
  s: GameState,
  team: Team,
  id: string,
  free = false,
  at?: { x: number; y: number; scale: number },
): boolean {
  const b = s.catalog[id];
  if (
    !b ||
    s.units.length >= MAX_ENTITIES ||
    s.phase === 'results' ||
    (!free && s.energy[team] < b.stats.spawnCost)
  )
    return false;
  if (!free) s.energy[team] -= b.stats.spawnCost;
  const scale = at?.scale ?? 1;
  const u: Entity = {
    id: s.nextId++,
    blueprintId: id,
    team,
    x: at?.x ?? (team === 'ember' ? 90 : 1110),
    y: at?.y ?? 135 + Math.floor(random(s) * 7) * 42,
    hp: Math.max(1, Math.round(b.stats.maxHealth * scale)),
    maxHp: Math.max(1, Math.round(b.stats.maxHealth * scale)),
    shield: 0,
    cooldown: Math.floor(random(s) * 10),
    slowUntil: 0,
    attacks: 0,
    child: !!at,
    born: s.tick,
  };
  if (!u.child) for (const a of b.abilities) if (a.op === 'shield') u.shield += a.amount;
  s.units.push(u);
  s.spawned++;
  s.peakEntities = Math.max(s.peakEntities, s.units.length);
  event(s, { kind: 'spawn', team, x: u.x, y: u.y });
  return true;
}
export function startGame(s: GameState) {
  if (s.phase !== 'lobby') return;
  s.phase = 'battle';
  for (const t of TEAMS) for (const b of STARTERS) spawn(s, t, b.id, true);
}
function hit(s: GameState, from: Entity, to: Entity, amount: number) {
  if (to.hp <= 0) return;
  const absorbed = Math.min(to.shield, amount);
  to.shield -= absorbed;
  const actual = Math.min(to.hp, amount - absorbed);
  to.hp -= actual;
  s.damage[from.team] += actual;
  event(s, {
    kind: 'attack',
    team: from.team,
    x: from.x,
    y: from.y,
    targetX: to.x,
    targetY: to.y,
    amount: actual,
  });
}
const distance = (a: Entity, b: Entity) => Math.hypot(a.x - b.x, a.y - b.y);
export function step(s: GameState, autoSpawn = true) {
  if (s.phase !== 'battle') return;
  s.tick++;
  if (s.tick % 20 === 0) for (const t of TEAMS) s.energy[t] = Math.min(60, s.energy[t] + 2);
  if (autoSpawn && s.tick % 70 === 0)
    for (const t of TEAMS) spawn(s, t, STARTERS[Math.floor(random(s) * STARTERS.length)]!.id);
  const order = [...s.units];
  if (s.tick % 2 === 0) order.reverse();
  for (const u of order) {
    if (u.hp <= 0) continue;
    const b = s.catalog[u.blueprintId]!;
    const stats = b.stats;
    u.cooldown = Math.max(0, u.cooldown - 1);
    if (!u.child)
      for (const a of b.abilities)
        if (a.op === 'heal' && s.tick % a.every === 0) {
          const ally = s.units
            .filter(
              (v) => v.team === u.team && v.hp > 0 && v.hp < v.maxHp && distance(u, v) <= a.radius,
            )
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
          if (ally) {
            const amount = Math.min(a.amount, ally.maxHp - ally.hp);
            ally.hp += amount;
            event(s, { kind: 'heal', team: u.team, x: ally.x, y: ally.y, amount });
          }
        }
    const target = s.units
      .filter((v) => v.team !== u.team && v.hp > 0)
      .sort((a, b) => distance(u, a) - distance(u, b) || a.id - b.id)[0];
    const destX = target?.x ?? (u.team === 'ember' ? 1140 : 60),
      destY = target?.y ?? 270;
    const d = Math.hypot(destX - u.x, destY - u.y);
    if (d > stats.attackRange) {
      const speed =
        stats.moveSpeed *
        (u.slowUntil > s.tick ? 0.5 : 1) *
        (s.tick > s.durationTicks * 0.8 ? 1.35 : 1);
      u.x += ((destX - u.x) / d) * speed;
      u.y += ((destY - u.y) / d) * speed;
      continue;
    }
    if (u.cooldown > 0) continue;
    u.cooldown = stats.attackCooldownTicks;
    u.attacks++;
    const damage = Math.max(1, Math.round(stats.attackDamage * (u.child ? 0.35 : 1)));
    if (target) {
      hit(s, u, target, damage);
      if (!u.child)
        for (const a of b.abilities) {
          if (a.op === 'slow') target.slowUntil = Math.max(target.slowUntil, s.tick + a.duration);
          if (a.op === 'splash' && u.attacks % a.every === 0)
            for (const v of s.units)
              if (v.team !== u.team && v.hp > 0 && distance(target, v) <= a.radius)
                hit(s, u, v, a.amount);
        }
    } else {
      const enemy = other(u.team);
      s.bases[enemy] = Math.max(0, s.bases[enemy] - damage);
      s.damage[u.team] += damage;
      event(s, { kind: 'base', team: u.team, x: destX, y: destY, amount: damage });
    }
  }
  const dead = s.units.filter((u) => u.hp <= 0);
  s.units = s.units.filter((u) => u.hp > 0);
  for (const u of dead) {
    s.scores[other(u.team)]++;
    event(s, { kind: 'death', team: u.team, x: u.x, y: u.y });
    if (!u.child)
      for (const a of s.catalog[u.blueprintId]!.abilities)
        if (a.op === 'split') {
          for (let i = 0; i < a.count; i++)
            spawn(s, u.team, u.blueprintId, true, {
              x: u.x,
              y: Math.max(80, Math.min(460, u.y + (i - 1) * 16)),
              scale: a.scale,
            });
          event(s, { kind: 'split', team: u.team, x: u.x, y: u.y, amount: a.count });
        }
  }
  if (s.bases.ember <= 0 || s.bases.azure <= 0 || s.tick >= s.durationTicks) {
    s.phase = 'results';
    const e = s.bases.ember - s.bases.azure || s.scores.ember - s.scores.azure;
    s.winner = e === 0 ? 'draw' : e > 0 ? 'ember' : 'azure';
  }
}
