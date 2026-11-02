import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../../packages/shared/src/index.js';
import { play } from './sfx.js';

export function BroadcastControls({
  s,
  labels,
  onLabels,
}: {
  s: Snapshot;
  labels: boolean;
  onLabels: (value: boolean) => void;
}) {
  const [sound, setSound] = useState(false);
  const [error, setError] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const forgeCue = `${s.roomId}:${s.game.phase}:${s.forge?.id ?? ''}:${s.forge?.status ?? ''}`;
  const last = useRef(forgeCue);
  const counts = useRef({ spawned: s.game.spawned, votes: 0, room: s.roomId, at: 0 });
  useEffect(() => {
    if (last.current === forgeCue) return;
    last.current = forgeCue;
    const ctx = audio.current;
    if (!sound || !ctx) return;
    if (s.game.phase === 'results') play(ctx, 'victory');
    else if (s.forge?.status === 'generating') play(ctx, 'forge');
    else if (s.forge?.status === 'approved') play(ctx, 'reveal');
    else if (s.forge?.status === 'deployed') play(ctx, 'deploy');
  }, [forgeCue, sound, s.game.phase, s.forge?.status]);
  // Spawns and votes are frequent, so they are throttled to one soft cue per 250 ms.
  const votes = s.proposals.reduce((sum, p) => sum + p.votes, 0);
  useEffect(() => {
    const c = counts.current;
    const fresh = c.room !== s.roomId;
    const spawned = s.game.spawned > c.spawned;
    const voted = votes > c.votes;
    counts.current = { spawned: s.game.spawned, votes, room: s.roomId, at: c.at };
    const ctx = audio.current;
    if (fresh || !sound || !ctx || (!spawned && !voted)) return;
    const now = performance.now();
    if (now - c.at < 250) return;
    counts.current.at = now;
    play(ctx, spawned ? 'spawn' : 'vote', 0.8);
  }, [s.game.spawned, votes, s.roomId, sound]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  async function toggleSound() {
    if (sound) {
      setSound(false);
      await audio.current?.suspend();
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setSound(true);
      setError('');
      play(audio.current, 'coin', 0.7);
    } catch {
      setError('Audio unavailable in this browser. Visual cues remain active.');
    }
  }
  return (
    <div className="broadcast-controls">
      <span>VIEWER TOOLS</span>
      <button aria-pressed={labels} onClick={() => onLabels(!labels)}>
        Unit labels: {labels ? 'on' : 'off'}
      </button>
      <button aria-pressed={sound} onClick={() => void toggleSound()}>
        Sound: {sound ? 'on' : 'off'}
      </button>
      <small>Synthesized cues for spawns, votes, the Forge anvil, deployments and victory.</small>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
