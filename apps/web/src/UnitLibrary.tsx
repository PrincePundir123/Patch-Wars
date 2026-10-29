import { useEffect, useRef, useState } from 'react';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { Heart } from '@phosphor-icons/react/dist/csr/Heart';
import { Sword } from '@phosphor-icons/react/dist/csr/Sword';
import type { Blueprint } from '../../../packages/shared/src/index.js';
import { STARTERS } from '../../../packages/game-core/src/index.js';
import { UnitPortrait } from './UnitPortrait.js';
import { abilityText } from './ForgeReveal.js';
export function UnitLibrary({ catalog }: { catalog?: Record<string, Blueprint> }) {
  const units = Object.values(catalog ?? Object.fromEntries(STARTERS.map((b) => [b.id, b])));
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [selected, setSelected] = useState<Blueprint | null>(null);
  const [copied, setCopied] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  const filtered = units.filter(
    (b) =>
      (role === 'all' || b.archetype === role) &&
      `${b.name} ${b.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function copy(b: Blueprint) {
    try {
      await navigator.clipboard.writeText(`!spawn ${b.id}`);
      setCopied('Command copied. Paste it into Twitch chat.');
    } catch {
      setCopied(`Type !spawn ${b.id} in Twitch chat.`);
    }
  }
  return (
    <section className="roster unit-library" id="units" aria-labelledby="unit-library-title">
      <div className="library-top">
        <div className="library-heading">
          <div>
            <span className="eyebrow">KNOW YOUR ARMY</span>
            <h2 id="unit-library-title">Every unit has a role.</h2>
          </div>
          <code>!spawn &lt;unit&gt;</code>
        </div>
        <div className="library-tools">
          <label className="unit-search">
            <MagnifyingGlass size={18} />
            <span className="sr-only">Search units</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find your next move"
            />
          </label>
          <label>
            <span className="sr-only">Filter unit role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="all">All roles</option>
              <option value="tank">Tank</option>
              <option value="ranged">Ranged</option>
              <option value="assassin">Assassin</option>
              <option value="support">Support</option>
              <option value="summoner">Summoner</option>
            </select>
          </label>
        </div>
      </div>
      <div className="unit-card-grid">
        {filtered.map((b) => (
          <button
            className="unit-card"
            key={b.id}
            onClick={() => {
              setCopied('');
              setSelected(b);
            }}
            aria-label={`Inspect ${b.name}`}
          >
            <div className={`unit-card-art role-${b.archetype}`}>
              <UnitPortrait shape={b.appearance.shape} />
              <span className="unit-cost">
                <Lightning weight="fill" size={13} />
                {b.stats.spawnCost}
              </span>
            </div>
            <div className="unit-card-copy">
              <small>{b.archetype}</small>
              <h3>{b.name}</h3>
              <span>View unit details</span>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p className="library-empty">No units match. Try another name or role.</p>
      )}
      <dialog
        ref={dialog}
        className="unit-dialog"
        onClose={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
        aria-labelledby="unit-detail-name"
      >
        {selected && (
          <>
            <button
              className="dialog-close"
              onClick={() => setSelected(null)}
              aria-label="Close unit details"
            >
              <X size={22} />
            </button>
            <div className={`dialog-art role-${selected.archetype}`}>
              <UnitPortrait shape={selected.appearance.shape} />
            </div>
            <div className="dialog-copy">
              <span className="eyebrow">{selected.archetype}</span>
              <h2 id="unit-detail-name">{selected.name}</h2>
              <p>{selected.description}</p>
              <dl className="unit-stats">
                <div>
                  <dt>
                    <Heart size={14} /> Health
                  </dt>
                  <dd>{selected.stats.maxHealth}</dd>
                </div>
                <div>
                  <dt>
                    <Sword size={14} /> Damage
                  </dt>
                  <dd>{selected.stats.attackDamage}</dd>
                </div>
                <div>
                  <dt>
                    <Lightning size={14} /> Energy
                  </dt>
                  <dd>{selected.stats.spawnCost}</dd>
                </div>
              </dl>
              {selected.abilities.length > 0 && (
                <ul>
                  {selected.abilities.map((a) => (
                    <li key={a.op}>{abilityText(a)}</li>
                  ))}
                </ul>
              )}
              <p className="unit-weakness">
                <strong>Counterplay.</strong> {selected.weaknesses.join(' ')}
              </p>
              <button className="button secondary" onClick={() => void copy(selected)}>
                <Copy size={16} />
                <code>!spawn {selected.id}</code>
              </button>
              <p className="command-help" aria-live="polite">
                {copied || 'Send this command in your connected Twitch chat during a battle.'}
              </p>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
