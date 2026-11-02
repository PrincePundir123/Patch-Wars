// Forge sigils: an original crest for every warrior, drawn in code from its blueprint.
// Pure and deterministic (FNV-1a seed + mulberry32), so every viewer sees the same crest
// and no external art model or generated markup is involved.

export type SigilInput = {
  id: string;
  name: string;
  archetype: 'tank' | 'ranged' | 'support' | 'assassin' | 'summoner';
  abilities: { op: 'shield' | 'slow' | 'split' | 'heal' | 'splash' }[];
  team?: 'ember' | 'azure';
};

export type Sigil = {
  seed: number;
  outline: 'heater' | 'round' | 'kite' | 'hex';
  division: 'plain' | 'pale' | 'bend' | 'chevron' | 'quarterly';
  field: string;
  tincture: string;
  metal: string;
  charge: 'tower' | 'bow' | 'leaf' | 'dagger' | 'egg';
  marks: ('shield' | 'slow' | 'split' | 'heal' | 'splash')[];
  rays: number;
  motto: string;
};

const FIELDS = {
  ember: ['#7a2a14', '#9c3a1a', '#5e2316', '#8a3f1f'],
  azure: ['#123f5a', '#1b5677', '#0f3149', '#21627e'],
  neutral: ['#3b2d55', '#29483b', '#4a3a1c', '#3d2a3a'],
};
const TINCTURES = ['#e9d8b4', '#c9b07a', '#d6e1d3', '#e8c9a8'];
const METALS = ['#f2c14e', '#e0e6ea', '#d99a4e'];
const CHARGES: Record<SigilInput['archetype'], Sigil['charge']> = {
  tank: 'tower',
  ranged: 'bow',
  support: 'leaf',
  assassin: 'dagger',
  summoner: 'egg',
};
const MOTTO_A = ['Iron', 'Ash', 'Frost', 'Dawn', 'Storm', 'Moss', 'Ember', 'Tide'];
const MOTTO_B = ['holds', 'answers', 'endures', 'rises', 'remembers', 'divides', 'returns'];

export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSigil(unit: SigilInput): Sigil {
  const seed = seedOf(`${unit.id}|${unit.name}|${unit.abilities.map((a) => a.op).join(',')}`);
  const r = random(seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)]!;
  const fields = FIELDS[unit.team ?? 'neutral'];
  return {
    seed,
    outline: pick(['heater', 'round', 'kite', 'hex'] as const),
    division: pick(['plain', 'pale', 'bend', 'chevron', 'quarterly'] as const),
    field: pick(fields),
    tincture: pick(TINCTURES),
    metal: pick(METALS),
    charge: CHARGES[unit.archetype],
    marks: [...new Set(unit.abilities.map((a) => a.op))].slice(0, 3),
    rays: 6 + Math.floor(r() * 7),
    motto: `${pick(MOTTO_A)} ${pick(MOTTO_B)}`,
  };
}

/** Rough archetype guess for a free-text idea, so the landing forge can preview a sigil while typing. */
export function sketchFromIdea(idea: string, team: 'ember' | 'azure'): SigilInput {
  const t = idea.toLowerCase();
  const archetype: SigilInput['archetype'] = /heal|mend|support|bless/.test(t)
    ? 'support'
    : /bow|arrow|shoot|ranged|sniper|throw/.test(t)
      ? 'ranged'
      : /stab|dagger|assassin|fast|sneak|ninja/.test(t)
        ? 'assassin'
        : /summon|split|slime|egg|swarm|spawn/.test(t)
          ? 'summoner'
          : 'tank';
  const abilities: SigilInput['abilities'] = [];
  if (/shield|armor|armour|wall|guard/.test(t)) abilities.push({ op: 'shield' });
  if (/frost|ice|slow|freeze|snow/.test(t)) abilities.push({ op: 'slow' });
  if (/split|slime|divide|clone/.test(t)) abilities.push({ op: 'split' });
  if (/heal|mend|regen|bless/.test(t)) abilities.push({ op: 'heal' });
  if (/bomb|fire|explode|splash|blast/.test(t)) abilities.push({ op: 'splash' });
  const words = idea.trim().split(/\s+/).filter(Boolean);
  const name = words.length ? words.slice(-2).join(' ') : 'Unnamed';
  return { id: 'sketch', name: name.slice(0, 32) || 'Unnamed', archetype, abilities, team };
}
