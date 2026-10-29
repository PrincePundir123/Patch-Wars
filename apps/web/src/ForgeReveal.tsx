import type { Ability, Snapshot } from '../../../packages/shared/src/index.js';
import { UnitIcon } from './UnitIcon.js';

export function abilityText(a: Ability): string {
  switch (a.op) {
    case 'shield':
      return `Starts with ${a.amount} shield points.`;
    case 'slow':
      return `Hits slow enemies for ${(a.duration / 20).toFixed(1)} seconds.`;
    case 'split':
      return `On defeat, splits into ${a.count} children at ${Math.round(a.scale * 100)}% health. Children cannot split.`;
    case 'heal':
      return `Restores ${a.amount} health to nearby allies every ${a.every / 20} seconds.`;
    case 'splash':
      return `Every ${a.every} attacks deals ${a.amount} area damage.`;
  }
}
export function ForgeReveal({ s }: { s: Snapshot }) {
  const f = s.forge;
  if (!f?.blueprint) return null;
  const b = f.blueprint;
  const remaining = Math.max(0, Math.ceil(((f.deploymentTick ?? s.game.tick) - s.game.tick) / 20));
  return (
    <div className="forge-reveal">
      <div className="reveal-heading">
        <UnitIcon shape={b.appearance.shape} />
        <div>
          <small>
            {b.archetype.toUpperCase()} ·{' '}
            {f.provider === 'fixture' ? 'PREDEFINED FIXTURE' : f.provider}
          </small>
          <h4>{b.name}</h4>
        </div>
      </div>
      <p>{b.description}</p>
      <dl className="unit-stats">
        <div>
          <dt>Health</dt>
          <dd>{b.stats.maxHealth}</dd>
        </div>
        <div>
          <dt>Damage</dt>
          <dd>{b.stats.attackDamage}</dd>
        </div>
        <div>
          <dt>Energy</dt>
          <dd>{b.stats.spawnCost}</dd>
        </div>
      </dl>
      <ul>
        {b.abilities.length ? (
          b.abilities.map((a) => <li key={a.op}>{abilityText(a)}</li>)
        ) : (
          <li>Wins through its base stats, with no special abilities.</li>
        )}
      </ul>
      <p className="unit-weakness">
        <strong>Counterplay:</strong> {b.weaknesses.join(' ')}
      </p>
      {f.status === 'approved' && (
        <div className="deploy-countdown" aria-live="polite">
          {s.paused
            ? 'Deployment paused'
            : remaining
              ? `Entering battle in ${remaining}s`
              : 'Waiting for space in the arena'}
        </div>
      )}
      {f.status === 'deployed' && (
        <div className="deploy-countdown">
          Live in this match · <code>!spawn {b.id}</code>
        </div>
      )}
    </div>
  );
}
