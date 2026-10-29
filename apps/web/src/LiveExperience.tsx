import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Snapshot, Team } from '../../../packages/shared/src/index.js';
import { UnitPortrait } from './UnitPortrait.js';
import { api } from './store.js';

export function LiveExperience({ s, children }: { s: Snapshot; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('');
  const [team, setTeam] = useState<Team>('ember');
  const [text, setText] = useState('');
  const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [tab, setTab] = useState<'chat' | 'forge'>('chat');
  const [embed, setEmbed] = useState(false);
  const channels = s.channels.filter((c) => c.status.startsWith('connected'));
  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const currentTeam = s.mode === 'demo' ? team : (channel?.team ?? 'ember');
  const blocked = s.paused || s.game.phase !== 'battle' || !s.commandsEnabled;
  useEffect(() => {
    void api<{ login: string | null }>('/api/viewer')
      .then((v) => setLogin(v.login))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), 1600);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    setEmbed(false);
  }, [channel?.id]);
  async function send(command: string) {
    if (busy || cooldown) return;
    setBusy(true);
    setReceipt('');
    try {
      const result =
        s.mode === 'demo'
          ? await api<{ message: string }>(`/api/rooms/${s.roomId}/demo-command`, {
              text: command,
              team,
            })
          : await api<{ message: string }>(`/api/rooms/${s.roomId}/viewer-command`, {
              text: command,
              channelId: channel?.id,
            });
      setReceipt(result.message);
      setCooldown(true);
    } catch (error) {
      setReceipt((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      setReceipt('Fullscreen is unavailable. This view already fills the browser window.');
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim()) void send(text.trim());
  }
  const canSend = s.mode === 'demo' || !!login;
  return (
    <main className="live-experience" ref={root}>
      <header className="live-header">
        <Link to="/" className="live-brand">
          PATCH <span>WARS</span>
        </Link>
        <span className={`live-badge ${s.mode}`}>
          <i />
          {s.mode === 'demo' ? 'SIMULATED REPLAY · FIXTURE FORGE' : 'TWITCH MATCH'}
        </span>
        <div className="live-header-actions">
          <Link to={`/spectate/${s.roomId}`}>Match details</Link>
          <button onClick={() => void fullscreen()}>Fullscreen</button>
        </div>
      </header>
      <div className="live-columns">
        <section className="live-battle-column" aria-label="Live battle and deployment">
          <div className="live-battle">{children}</div>
          <section className="deployment-dock" aria-label="Deploy units">
            <div className="deployment-heading">
              <div>
                <span className="eyebrow">YOUR NEXT MOVE</span>
                <h2>Deploy your army</h2>
              </div>
              <div className="deployment-account">
                {s.mode === 'demo' ? (
                  <label>
                    Demo team
                    <select
                      aria-label="Deployment team"
                      value={team}
                      onChange={(e) => setTeam(e.target.value as Team)}
                    >
                      <option value="ember">Ember</option>
                      <option value="azure">Azure</option>
                    </select>
                  </label>
                ) : (
                  <>
                    {channels.length > 1 && (
                      <select
                        aria-label="Participating channel"
                        value={channel?.id ?? ''}
                        onChange={(e) => setChannelId(e.target.value)}
                      >
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · {s.teamNames[c.team]}
                          </option>
                        ))}
                      </select>
                    )}
                    {login ? (
                      <>
                        <span>Playing as {login}</span>
                        <button
                          onClick={() =>
                            void api('/api/viewer/logout', {})
                              .then(() => setLogin(null))
                              .catch((e: Error) => setReceipt(e.message))
                          }
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <a
                        className="live-login"
                        href={`/auth/twitch/viewer?room=${s.roomId}&origin=${encodeURIComponent(location.origin)}`}
                      >
                        Sign in with Twitch to deploy
                      </a>
                    )}
                  </>
                )}
                <strong className={currentTeam}>
                  {s.game.energy[currentTeam]} <small>TEAM ENERGY</small>
                </strong>
              </div>
            </div>
            <div className="deployment-units">
              {Object.values(s.game.catalog).map((b) => (
                <button
                  key={b.id}
                  className={`deployment-card role-${b.archetype}`}
                  aria-label={`Deploy ${b.name}`}
                  disabled={
                    !canSend ||
                    (s.mode === 'live' && !channel) ||
                    blocked ||
                    busy ||
                    cooldown ||
                    s.game.energy[currentTeam] < b.stats.spawnCost
                  }
                  onClick={() => void send(`!spawn ${b.id}`)}
                >
                  <UnitPortrait shape={b.appearance.shape} />
                  <span className="deployment-cost">⚡ {b.stats.spawnCost}</span>
                  <span>
                    <small>{b.archetype}</small>
                    <strong>{b.name}</strong>
                  </span>
                </button>
              ))}
            </div>
            <div className="deployment-status" role="status">
              {receipt ||
                (blocked
                  ? s.paused
                    ? 'Battle paused. The host needs to resume.'
                    : s.game.phase === 'results'
                      ? 'Battle complete. The host can reset for another round.'
                      : !s.commandsEnabled
                        ? 'The host has paused commands.'
                        : 'Waiting for the host to start.'
                  : canSend
                    ? 'Select a unit to deploy. Shared team energy · same chat cooldowns · no payment.'
                    : 'Sign in to use unit buttons, or send !spawn archer in Twitch chat.')}
            </div>
          </section>
        </section>
        <aside className="live-community" aria-label="Community chat and Forge">
          <div className="live-community-tabs">
            <button aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>
              Stream chat
            </button>
            <button aria-pressed={tab === 'forge'} onClick={() => setTab('forge')}>
              Community Forge <span>{s.proposals.length}</span>
            </button>
          </div>
          {tab === 'chat' ? (
            <>
              <div className="live-chat-heading">
                <strong>
                  {s.mode === 'demo'
                    ? 'Replay activity'
                    : channel
                      ? `#${channel.name}`
                      : 'No channel connected'}
                </strong>
                {channel && (
                  <a
                    href={`https://www.twitch.tv/popout/${encodeURIComponent(channel.name)}/chat`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open chat ↗
                  </a>
                )}
              </div>
              {s.mode === 'live' && channel ? (
                <div className="twitch-chat-shell">
                  {embed ? (
                    <iframe
                      title={`${channel.name} Twitch chat`}
                      src={`https://www.twitch.tv/embed/${encodeURIComponent(channel.name)}/chat?parent=${encodeURIComponent(location.hostname)}&darkpopout`}
                    />
                  ) : (
                    <div className="live-chat-placeholder">
                      <span>CHAT WITH YOUR COMMUNITY</span>
                      <h2>Every message can make a move.</h2>
                      <p>
                        Load Twitch chat to read and send messages here. Twitch may ask you to sign
                        in separately.
                      </p>
                      <button onClick={() => setEmbed(true)}>Load Twitch chat</button>
                    </div>
                  )}
                  <p className="chat-fallback">
                    If embedded chat is blocked by your browser, use Open chat above.
                  </p>
                </div>
              ) : (
                <div className="live-activity" aria-label="Replay activity">
                  {s.mode === 'demo' && (
                    <p className="live-simulation-note">
                      Simulated game events, not real Twitch chat. Only this demo’s owner can send
                      commands.
                    </p>
                  )}
                  {s.commandFeedback.slice(0, 4).map((f) => (
                    <p key={`c${f.id}`}>
                      <code className={f.team}>!{f.command}</code>
                      <span>{f.message}</span>
                    </p>
                  ))}
                  {s.timeline.slice(0, 7).map((t) => (
                    <p key={t.id}>
                      <small>{Math.floor(t.tick / 20)}s</small>
                      <span>{t.text}</span>
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <section className="live-forge">
              <span className="eyebrow">COMMUNITY FORGE</span>
              <h2>Your idea. Their problem.</h2>
              <p>
                Propose a unit with <code>!forge your idea</code>. Vote when the host opens voting.
              </p>
              <strong className="live-forge-phase">{s.forge?.status ?? s.roundPhase}</strong>
              {s.forge?.error && <p>{s.forge.error}</p>}
              {s.forge?.name && (
                <p>
                  {s.forge.name}
                  {s.forge.report ? ` · ${s.forge.report.engagements} balance engagements` : ''}
                </p>
              )}
              {s.proposals.map((p) => (
                <div className="live-proposal" key={p.id}>
                  <p>
                    <code>{p.id}</code> {p.idea}
                  </p>
                  <button
                    disabled={!canSend || blocked || busy || cooldown || s.roundPhase !== 'voting'}
                    onClick={() => void send(`!vote ${p.id}`)}
                  >
                    Vote · {p.votes}
                  </button>
                </div>
              ))}
              {!s.proposals.length && (
                <p className="live-forge-empty">
                  No proposals yet. The next unit starts with your message.
                </p>
              )}
            </section>
          )}
          {canSend && (
            <form className="live-command-form" onSubmit={submit}>
              <label htmlFor="live-command">
                {s.mode === 'demo' ? 'Simulated command' : 'Game command'}
              </label>
              <div>
                <input
                  id="live-command"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="!forge a moss guardian"
                  maxLength={220}
                  required
                />
                <button disabled={busy || cooldown || blocked || (s.mode === 'live' && !channel)}>
                  Send
                </button>
              </div>
              <small>
                {s.mode === 'demo'
                  ? 'Local simulation only. Never sent to Twitch.'
                  : 'Game actions go to the arena. Use Twitch chat above for conversation.'}
              </small>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
