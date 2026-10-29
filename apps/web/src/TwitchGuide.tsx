import type { Snapshot } from '../../../packages/shared/src/index.js';

export function TwitchGuide({ s }: { s: Snapshot }) {
  const connected = s.channels.some((c) => c.status.startsWith('connected'));
  const received = s.commandFeedback.length > 0;
  const deployed = s.commandFeedback.some((r) => r.entityId !== undefined);
  const active = s.game.phase === 'battle' && !s.paused;
  return (
    <section className="twitch-guide panel" aria-label="Twitch match checklist">
      <div>
        <span className="eyebrow">CHAT TO COMBAT</span>
        <h2 className="sr-only">
          {s.game.phase === 'results'
            ? 'Battle finished. Ready for a rematch?'
            : 'Make your first move.'}
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
