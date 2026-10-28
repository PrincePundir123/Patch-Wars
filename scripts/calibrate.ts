import { balance, validateBlueprint } from '../apps/forge-worker/src/pipeline.js';
import { SLIME, STARTERS } from '../packages/game-core/src/index.js';
for (const [health, damage, cost] of [
  [95, 8, 5],
  [100, 8, 5],
  [110, 10, 6],
  [95, 10, 5],
  [85, 8, 5],
]) {
  const b = {
    ...SLIME,
    stats: { ...SLIME.stats, maxHealth: health!, attackDamage: damage!, spawnCost: cost! },
  };
  validateBlueprint(b);
  console.log({ health, damage, cost, ...(await balance(b, 40)) });
}
for (const damage of [8, 10, 12]) {
  const b = { ...STARTERS[3]!, stats: { ...STARTERS[3]!.stats, attackDamage: damage } };
  console.log({ medicDamage: damage, ...(await balance(b, 40)) });
}
