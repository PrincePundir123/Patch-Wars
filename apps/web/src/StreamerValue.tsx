import { useRef, useState } from 'react';
import { SOLDIER_PRODUCTS } from '../../../packages/shared/src/payments.js';
import { STARTERS, SLIME } from '../../../packages/game-core/src/catalog.js';
import { ForgeSigil } from './ForgeSigil.js';
import { sketchFromIdea } from './sigil.js';
import { play } from './sfx.js';

// Twitch's Bits in Extensions terms: the broadcaster receives 80% of 1 US cent per Bit used.
export const STREAMER_CENTS_PER_BIT = 0.8;
const AVERAGE_BITS = SOLDIER_PRODUCTS.reduce((sum, p) => sum + p.bits, 0) / SOLDIER_PRODUCTS.length;

export function estimateEarnings(
  viewers: number,
  buyerPercent: number,
  perBuyer: number,
  streams: number,
) {
  const deployments = Math.round(viewers * (buyerPercent / 100) * perBuyer);
  const bits = Math.round(deployments * AVERAGE_BITS);
  const perStream = (bits * STREAMER_CENTS_PER_BIT) / 100;
  return { deployments, bits, perStream, perMonth: perStream * streams };
}

const money = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n < 100 ? 2 : 0,
  });

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="sv-slider">
      <span>
        {label}
        <b>
          {value.toLocaleString('en-US')}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
    </label>
  );
}

function Estimator() {
  const [viewers, setViewers] = useState(300);
  const [buyers, setBuyers] = useState(6);
  const [perBuyer, setPerBuyer] = useState(3);
  const [streams, setStreams] = useState(12);
  const e = estimateEarnings(viewers, buyers, perBuyer, streams);
  const top = SOLDIER_PRODUCTS.at(-1)!.bits;
  return (
    <div className="sv-estimator" aria-label="Bits earnings estimator">
      <div className="sv-estimator-head">
        <span className="sv-kicker">BITS ESTIMATOR</span>
        <span className="sv-tag">Illustrative · your audience decides</span>
      </div>
      <Slider
        label="Average viewers"
        value={viewers}
        min={20}
        max={5000}
        step={10}
        onChange={setViewers}
      />
      <Slider
        label="Viewers who deploy a soldier"
        value={buyers}
        min={1}
        max={25}
        suffix="%"
        onChange={setBuyers}
      />
      <Slider
        label="Soldiers per buyer, per stream"
        value={perBuyer}
        min={1}
        max={10}
        onChange={setPerBuyer}
      />
      <Slider label="Streams per month" value={streams} min={1} max={30} onChange={setStreams} />
      <div className="sv-results">
        <div>
          <small>Soldiers deployed</small>
          <strong>{e.deployments.toLocaleString('en-US')}</strong>
        </div>
        <div>
          <small>Bits per stream</small>
          <strong>{e.bits.toLocaleString('en-US')}</strong>
        </div>
        <div className="sv-hero-number">
          <small>Streamer share / month</small>
          <strong data-testid="monthly-estimate">{money(e.perMonth)}</strong>
        </div>
      </div>
      <div className="sv-products" aria-label="Fixed soldier prices">
        {SOLDIER_PRODUCTS.map((p) => (
          <div key={p.sku}>
            <i style={{ height: `${(p.bits / top) * 100}%` }} />
            <b>{p.bits}</b>
            <span>{p.name}</span>
          </div>
        ))}
      </div>
      <p className="sv-fine">
        Estimate = viewers × buyers × soldiers × average price ({AVERAGE_BITS} Bits) ×{' '}
        {STREAMER_CENTS_PER_BIT}¢, the broadcaster's share per Bit used in a Twitch Extension. Bits
        checkout ships behind a broadcaster switch and is off by default.
      </p>
    </div>
  );
}

function SigilForge() {
  const [idea, setIdea] = useState('A frost knight with a shield that slows attackers');
  const [team, setTeam] = useState<'ember' | 'azure'>('azure');
  const [struck, setStruck] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const unit = sketchFromIdea(idea, team);
  async function strike() {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      play(audio.current, 'forge', 0.9);
    } catch {
      // Sound is optional; the sigil still renders.
    }
    setStruck((n) => n + 1);
  }
  return (
    <div className="sv-forge">
      <div className="sv-estimator-head">
        <span className="sv-kicker">SIGIL FORGE</span>
        <span className="sv-tag">Drawn in code · no image model</span>
      </div>
      <div className="sv-forge-body">
        <div key={struck} className="sv-sigil-stage">
          <ForgeSigil unit={unit} size={168} motto />
        </div>
        <div className="sv-forge-form">
          <label>
            <span>Describe a warrior</span>
            <textarea
              value={idea}
              maxLength={120}
              rows={3}
              onChange={(e) => setIdea(e.target.value)}
            />
          </label>
          <div className="sv-team" role="group" aria-label="Team">
            {(['ember', 'azure'] as const).map((t) => (
              <button key={t} className={t} aria-pressed={team === t} onClick={() => setTeam(t)}>
                {t === 'ember' ? 'Ember' : 'Azure'}
              </button>
            ))}
          </div>
          <button className="sv-strike" onClick={() => void strike()}>
            Strike the anvil
          </button>
          <p>
            Every Forged warrior gets a crest generated from its blueprint: archetype sets the
            charge, abilities set the marks, and a seeded hash picks shape and colours.
          </p>
        </div>
      </div>
      <div className="sv-crest-row" aria-label="Crests generated for the starter units">
        {[...STARTERS, SLIME].map((b, i) => (
          <div key={b.id}>
            <ForgeSigil unit={{ ...b, team: i % 2 ? 'azure' : 'ember' }} size={64} />
            <span>{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StreamerValue() {
  return (
    <section className="streamer-value" aria-labelledby="sv-title">
      <div className="sv-intro">
        <span className="sv-kicker">BUILT FOR STREAMERS</span>
        <h2 id="sv-title">
          Your chat stops watching.
          <br />
          <em>It starts playing.</em>
        </h2>
        <p>
          PATCH WARS turns a Twitch channel into a live strategy game. Viewers type to command an
          army, invent new warriors together, and back their side with Bits. Two streamers can put
          their communities on opposite castles and settle it on air.
        </p>
      </div>
      <div className="sv-pillars">
        <article>
          <span>01</span>
          <h3>Earn while they play</h3>
          <p>
            Fixed 10–50 Bits soldier drops through the Twitch Extension. Every purchase is a visible
            moment on stream, recorded and recoverable.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Collab battles</h3>
          <p>
            Two channels, two castles. Each community commands its own side, so a collab becomes a
            rivalry both audiences care about.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Chat designs the meta</h3>
          <p>
            Viewers propose units, vote once each, and the Forge validates and balance-tests the
            winner in 200 battles before it deploys.
          </p>
        </article>
      </div>
      <div className="sv-collab" aria-label="Two streamers, one battlefield">
        <div className="sv-channel ember">
          <b>Streamer A</b>
          <small>Ember castle · chat commands</small>
        </div>
        <img
          src="/art/castle-lane.webp"
          alt="Ember and Azure castles facing each other across a stone lane"
          loading="lazy"
        />
        <div className="sv-channel azure">
          <b>Streamer B</b>
          <small>Azure castle · chat commands</small>
        </div>
      </div>
      <div className="sv-tools">
        <Estimator />
        <SigilForge />
      </div>
    </section>
  );
}
