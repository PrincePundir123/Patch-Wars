import { useEffect, useState } from 'react';
import type { Snapshot } from '../../../packages/shared/src/index.js';

export function CommandFeedback({ s }: { s: Snapshot }) {
  const latest = s.commandFeedback?.[0];
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!latest) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [latest?.id, s.roomId]);
  return (
    <div className={`command-feedback ${latest?.team ?? ''}`} aria-live="polite" aria-atomic="true">
      {visible && latest && s.game.phase !== 'results' && (
        <>
          <small>
            {s.mode === 'demo'
              ? 'SIMULATED CHAT'
              : latest.source === 'extension'
                ? 'TWITCH EXTENSION'
                : latest.source === 'viewer'
                  ? 'VIEWER CONTROLS'
                  : 'TWITCH CHAT'}{' '}
            · {s.teamNames[latest.team]} · !{latest.command}
          </small>
          <strong>{latest.message}</strong>
        </>
      )}
    </div>
  );
}
