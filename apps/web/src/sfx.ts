// A tiny synthesized sound kit. Every sound is built from oscillators and noise at play time:
// no audio files, no licences, nothing to download. Callers own the AudioContext so the
// browser's autoplay rule (sound starts only after a click) stays with the user.

export type Cue = 'spawn' | 'forge' | 'reveal' | 'deploy' | 'victory' | 'coin' | 'vote';

function tone(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  at: number,
  dur: number,
  {
    type = 'triangle',
    gain = 0.12,
    glide,
  }: { type?: OscillatorType; gain?: number; glide?: number } = {},
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
  o.onended = () => g.disconnect();
}

function noise(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  dur: number,
  from: number,
  to: number,
  gain = 0.08,
) {
  const length = Math.ceil(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buffer;
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(at);
  src.onended = () => g.disconnect();
}

const NOTE = (n: number) => 440 * 2 ** ((n - 69) / 12);

export function play(ctx: AudioContext, cue: Cue, volume = 1) {
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);
  const t = ctx.currentTime + 0.01;
  switch (cue) {
    case 'spawn':
      tone(ctx, out, 220, t, 0.16, { type: 'square', gain: 0.05, glide: 330 });
      noise(ctx, out, t, 0.12, 900, 2400, 0.04);
      break;
    case 'vote':
      tone(ctx, out, NOTE(76), t, 0.12, { type: 'sine', gain: 0.08 });
      break;
    case 'coin':
      tone(ctx, out, NOTE(83), t, 0.09, { type: 'square', gain: 0.05 });
      tone(ctx, out, NOTE(88), t + 0.08, 0.32, { type: 'square', gain: 0.05 });
      break;
    case 'forge':
      // The anvil: a struck metal partial over a low thud, then a rising shimmer.
      tone(ctx, out, 70, t, 0.35, { type: 'sine', gain: 0.2, glide: 45 });
      [1, 2.76, 5.4].forEach((m, i) =>
        tone(ctx, out, 520 * m, t, 0.6 - i * 0.12, { type: 'sine', gain: 0.05 }),
      );
      noise(ctx, out, t + 0.1, 1.1, 400, 6000, 0.05);
      break;
    case 'reveal':
      [60, 64, 67, 72, 76].forEach((n, i) =>
        tone(ctx, out, NOTE(n), t + i * 0.07, 0.5, { gain: 0.07 }),
      );
      break;
    case 'deploy':
      // A short brass-like horn call: a fifth, then the octave.
      [55, 62].forEach((n) => tone(ctx, out, NOTE(n), t, 0.28, { type: 'sawtooth', gain: 0.035 }));
      [55, 62, 67].forEach((n) =>
        tone(ctx, out, NOTE(n), t + 0.3, 0.7, { type: 'sawtooth', gain: 0.035 }),
      );
      tone(ctx, out, 60, t, 0.4, { type: 'sine', gain: 0.18, glide: 40 });
      break;
    case 'victory':
      [
        [60, 0],
        [64, 0.14],
        [67, 0.28],
        [72, 0.46],
      ].forEach(([n, d]) =>
        tone(ctx, out, NOTE(n!), t + d!, 0.5, { type: 'triangle', gain: 0.09 }),
      );
      [48, 55, 64, 72].forEach((n) =>
        tone(ctx, out, NOTE(n), t + 0.62, 1.4, { type: 'triangle', gain: 0.06 }),
      );
      noise(ctx, out, t + 0.6, 1.2, 3000, 8000, 0.03);
      break;
  }
  setTimeout(() => out.disconnect(), 3000);
}
