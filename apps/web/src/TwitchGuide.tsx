import type { Snapshot } from '../../../packages/shared/src/index.js';

export function TwitchGuide({ s }: { s: Snapshot }) {
  const connected = s.channels.some((c) => c.status.startsWith('connected'));
  const twitchFeedback = s.commandFeedback.filter((r) => !r.source || r.source === 'twitch');
  const received = twitchFeedback.length > 0;
  const deployed = twitchFeedback.some((r) => r.entityId !== undefined);
  const active = s.game.phase === 'battle' && !s.paused;
  return (
    <section className="twitch-guide panel" aria-label="Twitch match checklist">
      <div>
        <span className="eyebrow">LIVE MATCH · COMMANDS GO IN TWITCH CHAT</span>
        <h2 className="guide-next-step">
          {s.game.phase === 'results'
            ? 'Next: reset for another battle'
            : !connected
              ? 'Next: connect your channel'
              : s.paused
                ? 'Next: resume the battle'
                : !active
                  ? 'Next: start the battle'
                  : !received
                    ? 'Next: send !spawn archer in Twitch chat'
                    : !deployed
                      ? 'Command received. Deploy your first unit.'
                      : 'Your chat is reaching the battlefield.'}
        </h2>
        <p>
          {s.game.phase === 'results'
            ? 'Reset, then Start battle before sending another spawn command.'
            : !connected
              ? 'Connect Ember with Twitch in the connections panel below.'
              : s.paused
                ? 'Resume the battle to deploy units.'
                : !active
                  ? 'Your channel is connected. Press Start battle above.'
                  : 'Open your connected channel’s chat and send !spawn archer. Look for the labelled unit on your team’s side.'}
        </p>
        <div className="quick-controls">
          {!connected && (
            <a className="button secondary compact" href="#controls">
              Open Twitch connections
            </a>
          )}
          {connected && !active && (
            <a className="button secondary compact" href="#match-actions">
              Open match controls
            </a>
          )}
          {s.channels.map((c) => (
            <a
              className={`button secondary compact ${c.team}`}
              key={c.id}
              href={`https://www.twitch.tv/${encodeURIComponent(c.name)}/chat`}
              target="_blank"
              rel="noreferrer"
            >
              Open {c.name} chat
            </a>
          ))}
        </div>
        {s.commandFeedback[0] && (
          <p className="first-command-feedback">
            Last received: !{s.commandFeedback[0].command} — {s.commandFeedback[0].message}
          </p>
        )}
      </div>
      <ol className="setup-checklist">
        {[
          [connected, 'Channel connected'],
          [active, 'Battle running'],
          [received, 'Chat command received'],
          [deployed, 'Viewer unit deployed'],
        ].map(([done, label]) => (
          <li key={String(label)} data-complete={done}>
            <span>{done ? 'Done' : 'Next'}</span>
            {label}
          </li>
        ))}
      </ol>
      <details className="guide-details">
        <summary>Chat command help</summary>
        <p className="guide-note">
          Type commands on Twitch, not in this dashboard. Wait at least two seconds between
          messages. Orange is Ember; blue is Azure.
        </p>
      </details>
    </section>
  );
}
