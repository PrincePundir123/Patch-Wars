import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../../packages/shared/src/index.js';

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
  const cue = `${s.roomId}:${s.game.phase}:${s.forge?.id ?? ''}:${s.forge?.status ?? ''}`;
  const last = useRef(cue);
  useEffect(() => {
    if (last.current === cue) return;
    last.current = cue;
    if (!sound || !audio.current || (s.game.phase !== 'results' && s.forge?.status !== 'deployed'))
      return;
    const ctx = audio.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(s.game.phase === 'results' ? 660 : 440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.31);
  }, [cue, sound, s.game.phase, s.forge?.status]);
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
      <small>Sound marks Forge deployments and match results.</small>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
