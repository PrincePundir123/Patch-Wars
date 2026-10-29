import type { Blueprint } from '../../shared/src/index.js';
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
