import { useEffect, useState, useRef, type FormEvent } from 'react';
import { Link, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Arena, UnitIcon } from './Arena.js';
import { api, useBattle } from './store.js';
import { STARTERS } from '../../../packages/game-core/src/index.js';
import type { Snapshot, Team } from '../../../packages/shared/src/index.js';
function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Patch Wars home">
      <span className="brand-symbol">
        P<span>W</span>
      </span>
      <span>
        PATCH<span className="brand-light">WARS</span>
      </span>
      <sup>BETA</sup>
    </Link>
  );
}
function Header() {
  return (
    <header className="topbar">
      <Brand />
      <nav aria-label="Main navigation">
        <Link to="/">Overview</Link>
        <Link to="/demo">Battlefield</Link>
        <Link to="/dashboard">
          Control room <span>↗</span>
        </Link>
      </nav>
      <span className="top-note">
        <i /> BUILT FOR TWITCH
      </span>
    </header>
  );
}
function ErrorBox({ text }: { text: string }) {
  return text ? (
    <div className="error" role="alert">
      {text}
    </div>
  ) : null;
}
function useRoom(id?: string) {
  const setSnapshot = useBattle((s) => s.setSnapshot),
    setConnection = useBattle((s) => s.setConnection);
  useEffect(() => {
    if (!id) return;
    let closed = false;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let lastSeq = -1;
    setSnapshot(null);
    function connect() {
      setConnection(attempts ? 'reconnecting' : 'connecting');
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${id}`,
      );
      socket.onopen = () => {
        attempts = 0;
        setConnection('connected');
      };
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as Snapshot;
          if (data.type === 'snapshot' && data.roomId === id && data.seq > lastSeq) {
            lastSeq = data.seq;
            setSnapshot(data);
          }
        } catch {
          setConnection('offline');
        }
      };
      socket.onclose = (e) => {
        if (closed) return;
        setConnection('reconnecting');
        if (e.code === 1008) {
          setConnection('offline');
          return;
        }
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10000));
      };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.close();
      setConnection('offline');
    };
  }, [id, setSnapshot, setConnection]);
}
function Landing() {
  return (
    <>
      <Header />
      <main className="landing">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="lime-dot" /> CHAT IS YOUR CONTROLLER
          </div>
          <h1>
            Two communities.
            <br />
            One battlefield.
            <br />
            <em>You write the rules.</em>
          </h1>
          <p>
            Your chat commands the army. Your imagination builds the next unit. Turn your stream
            into a battle nobody has seen before.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/demo">
              Enter the demo <span>↗</span>
            </Link>
            <Link className="button secondary" to="/dashboard">
              Connect with Twitch <span>▣</span>
            </Link>
          </div>
          <div className="hero-foot">
            <span>NO DOWNLOADS</span>
            <span>OBS READY</span>
            <span>BUILT WITH CODEX</span>
          </div>
        </div>
        <div className="hero-stage">
          <div className="stage-label">
            <span>
              <i /> BATTLE PREVIEW
            </span>
            <span>
              EMBER <b>VS</b> AZURE
            </span>
          </div>
          <Arena preview />
          <div className="chat-bubble">
            <span className="avatar">k</span>
            <div>
              <small>viewer concept</small>
              <p>
                <b>!forge</b> a slime that splits into three
              </p>
            </div>
            <span className="spark">✦</span>
          </div>
          <div className="preview-label">LOCAL SIMULATION · NO TWITCH CONNECTION</div>
        </div>
        <section className="how">
          <div>
            <span className="eyebrow">FROM CHAT TO COMBAT</span>
            <h2>
              The next game mechanic
              <br />
              is in your chat.
            </h2>
          </div>
          <article>
            <span className="step-number">01 / COMMAND</span>
            <h3>Rally your community</h3>
            <p>Spawn units, push the frontline, and defend your base. Every command matters.</p>
          </article>
          <article>
            <span className="step-number">02 / CREATE</span>
            <h3>Forge the unexpected</h3>
            <p>
              Pitch a unit. Vote together. The Forge validates its abilities and tests its balance.
            </p>
          </article>
          <article>
            <span className="step-number">03 / UNLEASH</span>
            <h3>Change the battlefield</h3>
            <p>Watch the winning creation enter combat. Then let the other community answer.</p>
          </article>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Two Communities. One Battlefield. Infinite Possibilities.</span>
        <Link to="/dashboard">Launch control room ↗</Link>
      </footer>
    </>
  );
}
function ForgePanel({ s }: { s: Snapshot }) {
  const f = s.forge;
  const phases = ['generating', 'validating', 'simulating', 'approved', 'deployed'];
  return (
    <section className="panel forge-panel">
      <div className="panel-heading">
        <h2>
          <span className="forge-star">✦</span> THE FORGE
        </h2>
        <span className="tiny-tag">
          {s.provider === 'fixture' ? 'FIXTURE OUTPUT' : 'AI GENERATION'}
        </span>
      </div>
      <div className="forge-title">
        <span className="eyebrow">{f ? 'COMMUNITY CREATION' : 'BUILD SOMETHING UNEXPECTED'}</span>
        <h3>{f?.name ?? (f ? 'Blueprint in progress' : 'Your idea. Their problem.')}</h3>
        <p>{f?.idea ?? 'Pitch a new unit in chat. The community decides what enters the arena.'}</p>
      </div>
      <div className={`forge-visual ${f?.status === 'deployed' ? 'revealed' : ''}`}>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <span className="forge-unit">{f?.status === 'deployed' ? '◉' : '✦'}</span>
        <span className="forge-visual-label">
          {f?.status === 'deployed'
            ? 'UNIT DEPLOYED'
            : f?.status === 'rejected'
              ? 'BLUEPRINT REJECTED'
              : (f?.status?.toUpperCase() ?? 'AWAITING YOUR IDEA')}
        </span>
      </div>
      {f ? (
        <>
          <div className="pipeline">
            {phases.map((p, i) => {
              const complete = f.steps.some((x) => x.status === p);
              return (
                <div className={complete ? 'complete' : ''} key={p}>
                  <span>{complete ? '✓' : `0${i + 1}`}</span>
                  <p>
                    {
                      (
                        {
                          generating: 'Generate blueprint',
                          validating: 'Validate abilities',
                          simulating: 'Run balance battles',
                          approved: 'Approve balance',
                          deployed: 'Deploy to arena',
                        } as Record<string, string>
                      )[p]
                    }
                  </p>
                  {f.status === p && <i />}
                </div>
              );
            })}
          </div>
          {f.report && (
            <div className="balance-metrics">
              <div>
                <strong>{f.report.engagements}</strong>
                <span>TEST BATTLES</span>
              </div>
              <div>
                <strong>{Math.round(f.report.winRate * 100)}%</strong>
                <span>WIN RATE</span>
              </div>
              <div>
                <strong>
                  {f.report.durationMs}
                  <small>ms</small>
                </strong>
                <span>SIMULATION</span>
              </div>
            </div>
          )}
          {f.blueprint && (
            <div className="blueprint">
              <span>VALIDATED BEHAVIOR</span>
              {f.blueprint.abilities.map((a) => (
                <code key={a.op}>
                  {a.event} → {a.op}
                  {a.op === 'split' ? `(${a.count} children, ${a.scale * 100}% health)` : ''}
                </code>
              ))}
              <p>{f.blueprint.weaknesses.join(' ')}</p>
            </div>
          )}
          <ErrorBox text={f.error ?? ''} />
        </>
      ) : (
        <div className="forge-command">
          <span>CREATE YOUR FIRST UNIT</span>
          <code>!forge &lt;your wildest idea&gt;</code>
          <small>Bounded abilities. Tested before deployment.</small>
        </div>
      )}
    </section>
  );
}
function Scoreboard({ s }: { s: Snapshot }) {
  const time = Math.max(0, Math.ceil((s.game.durationTicks - s.game.tick) / 20));
  return (
    <div className="scoreboard">
      {(['ember', 'azure'] as Team[]).map((team, i) => (
        <div className={`team-score ${team}`} key={team}>
          <div className="team-emblem">{i ? '◆' : '⬟'}</div>
          <div className="team-detail">
            <small>
              {s.channels.find((c) => c.team === team)?.name ?? `TEAM ${team.toUpperCase()}`}
            </small>
            <h2>{s.teamNames[team]}</h2>
            <div className="base-bar">
              <span style={{ width: `${s.game.bases[team] / 10}%` }} />
            </div>
            <span className="base-label">{s.game.bases[team]} / 1000 BASE HP</span>
          </div>
          <strong>{String(s.game.scores[team]).padStart(2, '0')}</strong>
        </div>
      ))}
      <div className="match-clock">
        <span>
          {s.game.phase === 'results'
            ? 'FINAL'
            : s.paused
              ? 'PAUSED'
              : s.game.tick > s.game.durationTicks * 0.8
                ? 'FINAL ASSAULT'
                : 'BATTLE 01'}
        </span>
        <strong>
          {Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}
        </strong>
        <small>ELIMINATIONS</small>
      </div>
    </div>
  );
}
function Voting({ s }: { s: Snapshot }) {
  const total = s.proposals.reduce((a, p) => a + p.votes, 0);
  return (
    <section className="panel voting-panel">
      <div className="panel-heading">
        <h2>COMMUNITY BLUEPRINTS</h2>
        <span className="tiny-tag">
          {s.roundPhase === 'voting'
            ? 'VOTING OPEN'
            : s.roundPhase === 'processing'
              ? 'VOTE COMPLETE'
              : 'PROPOSALS OPEN'}
        </span>
      </div>
      <div className="proposal-list">
        {s.proposals.length ? (
          s.proposals.map((p) => (
            <div className="proposal" key={p.id}>
              <span className={`proposal-id ${p.team}`}>{p.id.toUpperCase()}</span>
              <div className="proposal-content">
                <p>{p.idea}</p>
                <small>
                  {s.teamNames[p.team]} community <b>·</b> <code>!vote {p.id}</code>
                </small>
                <div className="vote-track">
                  <span style={{ width: `${total ? (p.votes / total) * 100 : 0}%` }} />
                </div>
              </div>
              <strong>
                {p.votes}
                <small>VOTES</small>
              </strong>
            </div>
          ))
        ) : (
          <div className="empty-proposals">
            <span>＋</span>
            <p>The next legend starts with a message.</p>
            <code>!forge a slime that splits into three</code>
          </div>
        )}
      </div>
      <div className="vote-footer">
        <span>ONE VIEWER. ONE VOTE.</span>
        <span>
          {s.roundPhase === 'processing'
            ? 'FORGE IN PROGRESS'
            : `${Math.max(0, Math.ceil((s.roundEndsAtTick - s.game.tick) / 20))}s REMAINING`}
        </span>
      </div>
    </section>
  );
}
function Results({ s }: { s: Snapshot }) {
  return (
    <div className="results">
      <span className="eyebrow">BATTLE COMPLETE</span>
      <h2>
        {s.game.winner === 'draw'
          ? 'A battle for the ages.'
          : `${s.teamNames[s.game.winner!]} takes the crown.`}
      </h2>
      <p>
        {s.game.scores.ember} — {s.game.scores.azure} eliminations · {Math.round(s.game.tick / 20)}{' '}
        seconds · seed {s.game.seed}
      </p>
      <span>
        {s.forge?.name ? `Forged this match: ${s.forge.name}` : 'Every command shaped the battle.'}
      </span>
    </div>
  );
}
function BattleView({ s, overlay = false }: { s: Snapshot; overlay?: boolean }) {
  const transparent = new URLSearchParams(location.search).get('transparent') === '1';
  return (
    <div className={overlay ? `overlay-view ${transparent ? 'transparent' : ''}` : 'battle-layout'}>
      <div className="battle-main">
        <section className="battle-stage">
          <Scoreboard s={s} />
          <div className="arena-wrap">
            <Arena game={s.game} transparent={transparent} />
            <div className="arena-location">
              <span>◈</span> THE FRACTURE <small>NEUTRAL TERRITORY</small>
            </div>
            {s.game.phase === 'lobby' && (
              <div className="arena-message">
                <span>AWAITING COMMAND</span>
                <h2>Your battlefield is ready.</h2>
                <p>Start the battle from the control room.</p>
              </div>
            )}
            {s.game.phase === 'results' && <Results s={s} />}
          </div>
          <div className="arena-bottom">
            <span>
              <i /> {s.game.units.length} UNITS ON FIELD
            </span>
            <span className="ember">⬟ {s.game.energy.ember} ENERGY</span>
            <span className="azure">◆ {s.game.energy.azure} ENERGY</span>
            <span>20 HZ · SEED {s.game.seed}</span>
          </div>
        </section>
        {!overlay && (
          <>
            <Voting s={s} />
            <section className="roster">
              <div className="section-line">
                <span>YOUR STARTING LINEUP</span>
                <code>!spawn &lt;unit&gt;</code>
              </div>
              <div className="roster-grid">
                {STARTERS.map((b) => (
                  <div key={b.id}>
                    <UnitIcon shape={b.appearance.shape} />
                    <h3>{b.name}</h3>
                    <small>{b.archetype}</small>
                    <span>{b.stats.spawnCost} ENERGY</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      <aside className="battle-side">
        <ForgePanel s={s} />
        {!overlay && (
          <section className="panel timeline">
            <div className="panel-heading">
              <h2>BATTLE FEED</h2>
              <span className="tiny-tag">{s.mode === 'demo' ? 'REPLAY' : 'LIVE EVENTS'}</span>
            </div>
            <div>
              {s.timeline.slice(0, 6).map((e) => (
                <p key={e.id}>
                  <time>
                    {Math.floor(e.tick / 1200)}:
                    {String(Math.floor(e.tick / 20) % 60).padStart(2, '0')}
                  </time>
                  <span>{e.text}</span>
                </p>
              ))}
            </div>
          </section>
        )}
      </aside>
      {overlay && (
        <span className="overlay-mode">
          PATCH WARS · {s.mode === 'demo' ? 'SIMULATED REPLAY' : 'TWITCH MATCH'} ·{' '}
          {s.provider === 'fixture' ? 'FIXTURE FORGE' : s.provider}
        </span>
      )}
    </div>
  );
}
function MatchPage({ overlay = false }: { overlay?: boolean }) {
  const { id } = useParams();
  useRoom(id);
  const s = useBattle((x) => x.snapshot);
  const connection = useBattle((x) => x.connection);
  return (
    <>
      {!overlay && <Header />}
      {s ? (
        <main className={overlay ? '' : 'match-page'}>
          {!overlay && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">THE COMMUNITY BATTLEGROUND</span>
                <h1>
                  Watch the war unfold<span>.</span>
                </h1>
              </div>
              <span className="status-pill">
                <i />
                {connection} · {s.mode === 'demo' ? 'SIMULATED REPLAY' : 'TWITCH MATCH'}
              </span>
            </div>
          )}
          <BattleView s={s} overlay={overlay} />
        </main>
      ) : (
        <div className="loading">
          {connection === 'offline'
            ? 'Match unavailable. Open the control room to create one.'
            : 'Connecting to the battlefield…'}{' '}
          <Link to="/dashboard">Control room ↗</Link>
        </div>
      )}
    </>
  );
}
type Me = {
  operator: boolean;
  twitchConfigured: boolean;
  demoEnabled: boolean;
  provider: string;
  rooms: { id: string; mode: string }[];
};
function Dashboard({ demo = false }: { demo?: boolean }) {
  const [params, setParams] = useSearchParams();
  const id = params.get('room') ?? undefined;
  useRoom(id);
  const s = useBattle((x) => x.snapshot);
  const connection = useBattle((x) => x.connection);
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [text, setText] = useState('!spawn guardian');
  const [team, setTeam] = useState<Team>('ember');
  const [invite, setInvite] = useState('');
  const creating = useRef(false);
  useEffect(() => {
    void api<Me>('/api/me')
      .then(setMe)
      .catch((e) => setError(e.message));
    if (params.get('error'))
      setError(
        'Twitch connection failed: ' + params.get('error') + '. Check credentials and retry.',
      );
  }, [params]);
  async function create(mode: 'demo' | 'live') {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ id: string }>('/api/rooms', { mode });
      setParams({ room: r.id });
      if (mode === 'demo') await api(`/api/rooms/${r.id}/control`, { action: 'start' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (demo && !id && !creating.current) {
      creating.current = true;
      void create('demo');
    }
  }, [demo, id]); // A single owned replay per visit, including StrictMode.
  async function action(action: string, extra: object = {}) {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/rooms/${id}/control`, { action, ...extra });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    try {
      const r = await api<{ message: string }>(`/api/rooms/${id}/demo-command`, { text, team });
      setNotice(r.message);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function copyOverlay() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/overlay/${id}?transparent=1`);
      setNotice('Overlay URL copied. Paste it into an OBS Browser Source at 1920 × 1080.');
    } catch {
      setNotice(`Overlay URL: ${location.origin}/overlay/${id}?transparent=1`);
    }
  }
  async function unlock(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/session', { key });
      setKey('');
      setMe(await api<Me>('/api/me'));
      setNotice('Operator access unlocked.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const active = s?.roomId === id ? s : null;
  return (
    <>
      <Header />
      <main className="dashboard">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              {demo ? 'A FRONT ROW SEAT TO THE POSSIBILITIES' : 'MISSION CONTROL'}
            </span>
            <h1>
              {demo ? 'Welcome to the battlefield' : 'Your stream. Your arena'}
              <span>.</span>
            </h1>
            <p>
              {demo
                ? 'A reproducible local replay. All chat, raids, and Forge output here are simulated.'
                : 'Connect your community, set the rules, and let chat take it from here.'}
            </p>
          </div>
          <div className="heading-actions">
            {active && (
              <Link className="button secondary compact" to={`/spectate/${id}`} target="_blank">
                Spectator view ↗
              </Link>
            )}
            <span className="status-pill">
              <i />
              {active ? connection : 'READY TO SET UP'}
            </span>
          </div>
        </div>
        <ErrorBox text={error} />
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
              ×
            </button>
          </div>
        )}
        {!active ? (
          <section className="setup-grid">
            <div className="setup-card">
              <span className="eyebrow">01 / TRY IT FIRST</span>
              <h2>Meet your next stream obsession.</h2>
              <p>
                Start a 90-second replay featuring viewer proposals, community voting, the splitting
                slime, and a raid counterattack.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void create('demo')}
              >
                {busy ? 'Creating battlefield…' : 'Launch local replay ↗'}
              </button>
            </div>
            <div className="setup-card">
              <span className="eyebrow">02 / GO LIVE</span>
              <h2>Bring your Twitch community.</h2>
              <p>
                {me?.twitchConfigured
                  ? 'Twitch application configured. Unlock your operator session to create a match.'
                  : 'Add Twitch application credentials and ADMIN_KEY to your local .env file. See docs/setup.md.'}
              </p>
              {!me?.operator ? (
                <form onSubmit={(e) => void unlock(e)}>
                  <label htmlFor="operator-key">Operator key</label>
                  <input
                    id="operator-key"
                    type="password"
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Your local ADMIN_KEY"
                    required
                  />
                  <button className="button secondary" type="submit">
                    Unlock control room
                  </button>
                </form>
              ) : (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void create('live')}
                >
                  Create Twitch match ↗
                </button>
              )}
            </div>
            {me?.rooms.length ? (
              <div className="existing-rooms">
                <h3>Your recent matches</h3>
                {me.rooms.map((r) => (
                  <button
                    className="button secondary compact"
                    key={r.id}
                    onClick={() => setParams({ room: r.id })}
                  >
                    {r.mode.toUpperCase()} · {r.id.slice(0, 8)} ↗
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <>
            <div className="operator-bar">
              <div>
                <span className={`mode-label ${active.mode === 'demo' ? 'demo-label' : ''}`}>
                  {active.mode === 'demo' ? '◈ SIMULATED REPLAY' : '◈ TWITCH MATCH'}
                </span>
                <span className="muted">
                  {active.provider === 'fixture' ? 'Fixture Forge' : active.provider} ·{' '}
                  {active.sharedChat
                    ? 'Shared Chat detected'
                    : active.channels.length > 1
                      ? 'Separate channels'
                      : active.mode === 'demo'
                        ? 'Offline demo'
                        : 'Single-channel mode'}
                </span>
              </div>
              <div className="controls">
                {active.game.phase === 'lobby' ? (
                  <button
                    className="button primary compact"
                    disabled={busy}
                    onClick={() => void action('start')}
                  >
                    ▶ Start battle
                  </button>
                ) : active.game.phase !== 'results' ? (
                  <button
                    className="button secondary compact"
                    disabled={busy}
                    onClick={() => void action(active.paused ? 'resume' : 'pause')}
                  >
                    {active.paused ? '▶ Resume' : 'Ⅱ Pause'}
                  </button>
                ) : null}
                <button
                  className="button secondary compact"
                  disabled={busy}
                  onClick={() => void action('reset')}
                >
                  ↺ Reset
                </button>
                <button className="button secondary compact" onClick={() => void copyOverlay()}>
                  ▣ Copy OBS link
                </button>
              </div>
            </div>
            <BattleView s={active} />
            <section className="operator-grid">
              <div className="panel operator-panel">
                <div className="panel-heading">
                  <h2>{active.mode === 'demo' ? 'REPLAY CONTROLS' : 'TWITCH CONNECTIONS'}</h2>
                  <span className="tiny-tag">OPERATOR ONLY</span>
                </div>
                {active.mode === 'demo' ? (
                  <>
                    <p>Inject a simulated command into the same command handler used by Twitch.</p>
                    <form className="command-form" onSubmit={(e) => void send(e)}>
                      <label className="sr-only" htmlFor="team">
                        Team
                      </label>
                      <select
                        id="team"
                        value={team}
                        onChange={(e) => setTeam(e.target.value as Team)}
                      >
                        <option value="ember">⬟ Ember</option>
                        <option value="azure">◆ Azure</option>
                      </select>
                      <label className="sr-only" htmlFor="command">
                        Simulated chat command
                      </label>
                      <input
                        id="command"
                        value={text}
                        maxLength={220}
                        onChange={(e) => setText(e.target.value)}
                      />
                      <button className="button primary compact" type="submit">
                        Send ↗
                      </button>
                    </form>
                    <div className="quick-controls">
                      <button
                        onClick={() => {
                          setText('!forge a slime that splits into three when defeated');
                        }}
                      >
                        Slime proposal
                      </button>
                      <button
                        onClick={() => {
                          setText('!vote p1');
                        }}
                      >
                        Vote for P1
                      </button>
                      <button onClick={() => void action('raid')}>Simulate raid</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Each broadcaster authorizes their own channel. The second community uses a
                      temporary invitation.
                    </p>
                    {active.channels.map((c) => (
                      <div className="channel-row" key={c.id}>
                        <span className={c.team}>
                          {c.team === 'ember' ? '⬟' : '◆'} {c.name}
                        </span>
                        <span>{c.status}</span>
                        <button
                          onClick={() => {
                            void api(`/api/rooms/${id}/disconnect`, { team: c.team }).catch((e) =>
                              setError(e.message),
                            );
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                    <div className="quick-controls">
                      <a className="button secondary compact" href={`/auth/twitch?room=${id}`}>
                        Connect Ember with Twitch
                      </a>
                      <button
                        onClick={() => {
                          void api<{ url: string }>(`/api/rooms/${id}/invite`, {})
                            .then((r) => setInvite(r.url))
                            .catch((e) => setError(e.message));
                        }}
                      >
                        Invite Azure broadcaster
                      </button>
                    </div>
                    {invite && (
                      <div className="invite">
                        <label htmlFor="invite">
                          Share privately with the second broadcaster · expires in 10 minutes
                        </label>
                        <input
                          id="invite"
                          readOnly
                          value={invite}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="panel operator-panel">
                <div className="panel-heading">
                  <h2>MATCH SETTINGS</h2>
                  <span className="tiny-tag">{active.game.seed} SEED</span>
                </div>
                <Settings s={active} save={(extra) => void action('settings', extra)} />
                <div className="quick-controls">
                  <button
                    disabled={active.roundPhase !== 'proposals'}
                    onClick={() => void action('vote')}
                  >
                    Close proposals / open vote
                  </button>
                  <button
                    disabled={active.roundPhase !== 'voting'}
                    onClick={() => void action('forge')}
                  >
                    Close voting / forge winner
                  </button>
                </div>
              </div>
            </section>
            {active.roundPhase === 'proposals' && active.proposals.length > 0 && (
              <div className="moderation">
                <span>MODERATE PROPOSALS</span>
                {active.proposals.map((p) => (
                  <button key={p.id} onClick={() => void action('reject', { proposalId: p.id })}>
                    Remove {p.id.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <div className="dashboard-end">
              <span>
                OBS: 1920 × 1080 · 30 or 60 FPS · enable browser source hardware acceleration
              </span>
              <button onClick={() => navigate('/dashboard')}>Set up another match ↗</button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
function Settings({ s, save }: { s: Snapshot; save: (data: object) => void }) {
  const [ember, setEmber] = useState(s.teamNames.ember),
    [azure, setAzure] = useState(s.teamNames.azure),
    [duration, setDuration] = useState(s.game.durationTicks / 20),
    [commands, setCommands] = useState(s.commandsEnabled),
    [forge, setForge] = useState(s.forgeEnabled);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ ember, azure, duration, commandsEnabled: commands, forgeEnabled: forge });
      }}
    >
      <div className="settings-fields">
        <label>
          Ember name
          <input maxLength={24} value={ember} onChange={(e) => setEmber(e.target.value)} required />
        </label>
        <label>
          Azure name
          <input maxLength={24} value={azure} onChange={(e) => setAzure(e.target.value)} required />
        </label>
        <label>
          Duration (seconds)
          <input
            type="number"
            min={60}
            max={900}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            required
          />
        </label>
      </div>
      <div className="toggle-row">
        <label>
          <input
            type="checkbox"
            checked={commands}
            onChange={(e) => setCommands(e.target.checked)}
          />{' '}
          Chat commands
        </label>
        <label>
          <input type="checkbox" checked={forge} onChange={(e) => setForge(e.target.checked)} />{' '}
          Community Forge
        </label>
        <button className="button secondary compact" type="submit">
          Save settings
        </button>
      </div>
    </form>
  );
}
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Dashboard demo />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/spectate/:id" element={<MatchPage />} />
      <Route path="/overlay/:id" element={<MatchPage overlay />} />
      <Route
        path="*"
        element={
          <main className="loading">
            <h1>Off the battlefield.</h1>
            <Link to="/">Return home ↗</Link>
          </main>
        }
      />
    </Routes>
  );
}
