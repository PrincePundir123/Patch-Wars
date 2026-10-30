import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link } from 'react-router-dom';
import type { Snapshot, Team } from '../../../packages/shared/src/index.js';
import { UnitPortrait } from './UnitPortrait.js';
import { api, ApiError } from './store.js';

export function LiveExperience({
  s,
  children,
  embedded = false,
  expanded = true,
  onExit,
  onFullscreen,
  fullscreenActive = false,
  exitButtonRef,
  displayNotice = '',
}: {
  s: Snapshot;
  children: ReactNode;
  embedded?: boolean;
  expanded?: boolean;
  onExit?: () => void;
  onFullscreen?: () => void;
  fullscreenActive?: boolean;
  exitButtonRef?: RefObject<HTMLButtonElement | null>;
  displayNotice?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const inline = embedded && !expanded;
  const [login, setLogin] = useState<string | null>(null);
  const [authSource, setAuthSource] = useState<'viewer' | 'channel' | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [chatReceipt, setChatReceipt] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const identityRequest = useRef(0);
  const previousBattleState = useRef(
    `${s.roomId}:${s.game.phase}:${s.paused}:${s.commandsEnabled}`,
  );
  const [channelId, setChannelId] = useState('');
  const [team, setTeam] = useState<Team>('ember');
  const [text, setText] = useState('');
  const [receipt, setReceipt] = useState(() =>
    new URLSearchParams(location.search).has('error')
      ? 'Twitch sign-in did not complete. Try signing in again.'
      : '',
  );
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(1600);
  const [tab, setTab] = useState<'chat' | 'forge'>('chat');
  const [embed, setEmbed] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(true);
  const channels = s.channels.filter((c) => c.status.startsWith('connected'));
  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const currentTeam = s.mode === 'demo' ? team : (channel?.team ?? 'ember');
  const blocked = s.paused || s.game.phase !== 'battle' || !s.commandsEnabled;
  const signInUrl = `/auth/twitch/viewer?room=${s.roomId}&origin=${encodeURIComponent(location.origin)}`;
  const loadViewer = useCallback(async () => {
    const request = ++identityRequest.current;
    setAuthChecking(true);
    try {
      const viewer = await api<{
        login: string | null;
        source?: 'viewer' | 'channel' | null;
        canManage?: boolean;
      }>(`/api/viewer?room=${s.roomId}`);
      if (request !== identityRequest.current) return;
      setLogin(viewer.login);
      setAuthSource(viewer.source ?? null);
      setCanManage(viewer.canManage ?? false);
      setAuthError('');
    } catch {
      if (request === identityRequest.current) {
        setLogin(null);
        setCanManage(false);
        setAuthError('Could not check Twitch sign-in. Retry the connection check.');
      }
    } finally {
      if (request === identityRequest.current) setAuthChecking(false);
    }
  }, [s.roomId]);
  useEffect(() => {
    if (inline) return;
    const refresh = () => {
      if (!document.hidden) void loadViewer();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      identityRequest.current++;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [inline, loadViewer]);
  useEffect(() => {
    const next = `${s.roomId}:${s.game.phase}:${s.paused}:${s.commandsEnabled}`;
    if (previousBattleState.current !== next) setReceipt('');
    previousBattleState.current = next;
  }, [s.roomId, s.game.phase, s.paused, s.commandsEnabled]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), cooldownMs);
    return () => clearTimeout(timer);
  }, [cooldown, cooldownMs]);
  useEffect(() => {
    setEmbed(!inline && s.mode === 'live' && !!channel?.id);
  }, [channel?.id, s.mode, inline]);
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
      setCooldownMs(1600);
      setCooldown(true);
    } catch (error) {
      setReceipt((error as Error).message);
      if (error instanceof ApiError && error.status === 401) {
        setLogin(null);
        setAuthError(error.message);
      }
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
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    if (s.mode === 'live' && tab === 'chat') {
      if (chatBusy || cooldown) return;
      setChatBusy(true);
      setChatReceipt('');
      try {
        const sent=await api<{messageId:string}>(`/api/rooms/${s.roomId}/chat`, { text: text.trim(), channelId: channel?.id });
        if(!sent.messageId)throw new Error('Twitch did not confirm this message. Please try again.');
        setText('');
        setChatReceipt(
          `Sent to #${channel?.name}. Chat commands appear in the battle receipt when Twitch delivers them.`,
        );
        setCooldownMs(2100);
        setCooldown(true);
      } catch (error) {
        setChatReceipt((error as Error).message);
        if (error instanceof ApiError && error.status === 401) {
          setLogin(null);
          setAuthError(error.message);
        }
      } finally {
        setChatBusy(false);
      }
    } else void send(text.trim());
  }
  async function hostAction(action: 'start' | 'resume' | 'rematch') {
    setBusy(true);
    setReceipt('');
    try {
      if (action === 'rematch') await api(`/api/rooms/${s.roomId}/control`, { action: 'reset' });
      await api(`/api/rooms/${s.roomId}/control`, {
        action: action === 'rematch' ? 'start' : action,
      });
      setReceipt(
        action === 'rematch'
          ? 'New battle started. Choose a soldier.'
          : 'Battle running. Choose a soldier.',
      );
    } catch (error) {
      setReceipt((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canSend = s.mode === 'demo' || !!login;
  const isTwitchChat = s.mode === 'live' && tab === 'chat';
  return (
    <div
      role={embedded ? undefined : 'main'}
      className={`live-experience ${inline ? 'inline-experience' : 'stream-stage'}${communityOpen ? '' : ' chat-hidden'}`}
      ref={root}
    >
      <header className="live-header" hidden={inline}>
        <Link to="/" className="live-brand">
          PATCH <span>WARS</span>
        </Link>
        <span className={`live-badge ${s.mode}`}>
          <i />
          {s.mode === 'demo' ? 'SIMULATED REPLAY · FIXTURE FORGE' : 'TWITCH MATCH'}
        </span>
        <div className="live-header-actions">
          {embedded && (
            <button ref={exitButtonRef} onClick={onExit}>
              Exit theater
            </button>
          )}
          <Link to={`/spectate/${s.roomId}`}>Match details</Link>
          <button
            aria-expanded={communityOpen}
            aria-controls="stream-community"
            onClick={() => setCommunityOpen((open) => !open)}
          >
            {communityOpen ? 'Hide chat' : 'Show chat'}
          </button>
          <button
            aria-pressed={embedded ? fullscreenActive : undefined}
            onClick={() => (onFullscreen ? onFullscreen() : void fullscreen())}
          >
            {embedded && fullscreenActive ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </header>
      <div className="live-columns">
        <section className="live-battle-column" aria-label="Live battle and deployment">
          <div className="live-battle">{children}</div>
          <section className="deployment-dock" aria-label="Deploy units" hidden={inline}>
            <div className="deployment-heading">
              <div>
                <span className="eyebrow">REINFORCEMENTS</span>
                <h2>Choose a soldier</h2>
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
                        <span>
                          {authSource === 'channel' ? 'Channel account' : 'Playing as'} {login}
                        </span>
                        {authSource === 'channel' ? (
                          <a className="switch-player" href={signInUrl}>
                            Switch account
                          </a>
                        ) : (
                          <button
                            onClick={() =>
                              void api('/api/viewer/logout', {})
                                .then(() => loadViewer())
                                .catch((e: Error) => setReceipt(e.message))
                            }
                          >
                            Sign out
                          </button>
                        )}
                      </>
                    ) : authChecking ? (
                      <span>Checking Twitch account…</span>
                    ) : (
                      <a className="live-login" href={signInUrl}>
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
                  title={`${b.name} · ${b.archetype} · ${b.stats.spawnCost} team energy`}
                  disabled={
                    !canSend ||
                    (s.mode === 'live' && !channel) ||
                    blocked ||
                    busy ||
                    chatBusy ||
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
            <div
              className={`deployment-status${displayNotice ? ' display-notice' : ''}`}
              role="status"
            >
              {displayNotice ||
                receipt ||
                authError ||
                (s.mode === 'live' && !channel
                  ? 'Twitch channel disconnected. Reconnect it from the control room.'
                  : blocked
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
            {((canManage && (blocked || (s.mode === 'live' && !channel))) || authError) && (
              <div className="deployment-status-actions">
                {canManage && s.mode === 'live' && !channel && (
                  <a className="live-host-action" href={`/dashboard?room=${s.roomId}#controls`}>
                    Reconnect Twitch
                  </a>
                )}
                {canManage && s.game.phase === 'results' && (
                  <button
                    className="live-host-action"
                    disabled={busy}
                    onClick={() => void hostAction('rematch')}
                  >
                    Start rematch
                  </button>
                )}
                {canManage && s.game.phase === 'lobby' && (
                  <button
                    className="live-host-action"
                    disabled={busy}
                    onClick={() => void hostAction('start')}
                  >
                    Start battle
                  </button>
                )}
                {canManage && s.game.phase === 'battle' && s.paused && (
                  <button
                    className="live-host-action"
                    disabled={busy}
                    onClick={() => void hostAction('resume')}
                  >
                    Resume battle
                  </button>
                )}
                {authError && (
                  <button className="live-host-action" onClick={() => void loadViewer()}>
                    Retry connection check
                  </button>
                )}
              </div>
            )}
          </section>
        </section>
        <aside
          id="stream-community"
          className="live-community"
          aria-label="Community chat and Forge"
          hidden={inline || !communityOpen}
        >
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
                    Chat blocked? Use Open chat above.{' '}
                    {embed && <button onClick={() => setEmbed(false)}>Unload chat</button>}
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
            <form className="live-command-form" onSubmit={(event) => void submit(event)}>
              <label htmlFor="live-command">
                {s.mode === 'demo'
                  ? 'Simulated command'
                  : isTwitchChat
                    ? `Send Twitch chat as ${login}`
                    : 'Game command'}
              </label>
              <div>
                <input
                  id="live-command"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    isTwitchChat
                      ? `Message #${channel?.name ?? 'channel'} or !spawn archer`
                      : '!forge a moss guardian'
                  }
                  maxLength={isTwitchChat ? 450 : 220}
                  required
                />
                <button
                  disabled={
                    busy ||
                    chatBusy ||
                    cooldown ||
                    (!isTwitchChat && blocked) ||
                    (s.mode === 'live' && !channel)
                  }
                >
                  {chatBusy ? 'Sending…' : isTwitchChat ? 'Send to Twitch' : 'Send'}
                </button>
              </div>
              <small>
                {s.mode === 'demo'
                  ? 'Local simulation only. Never sent to Twitch.'
                  : isTwitchChat
                    ? `Posts to #${channel?.name ?? 'your channel'} using your connected Twitch account. Conversation works between battles too.`
                    : 'Game commands go to the arena. Use Stream chat for conversation.'}
              </small>
              {chatReceipt && (
                <p className="chat-send-status" role="status">
                  {chatReceipt}
                </p>
              )}
            </form>
          )}
          {!canSend && s.mode === 'live' && (
            <div className="chat-auth-prompt">
              <p>
                {authChecking
                  ? 'Checking your Twitch account…'
                  : 'Sign in once to send chat and use the soldier controls.'}
              </p>
              {!authChecking && <a href={signInUrl}>Sign in with Twitch</a>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
