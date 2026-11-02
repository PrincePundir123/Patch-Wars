"""The film's own house groove, composed here and rendered from a General MIDI SoundFont: nothing licensed, nothing a
recording could match. One tune from start to end, shaped by the film's real timeline:

- the opening (doors at 6:58): a muffled kick and a minor pad (Am F C G), hats creeping in;
- from "This is House Mix": the full groove at 122 BPM, four-on-the-floor kick, offbeat hats, a clap on 2 and 4,
  an offbeat bassline and electric-piano stabs over warmer chords (C G Am F);
- the recap: sixteenth hats, open hats on the offbeat, the stabs doubled an octave up, louder;
- the end card: one last kick and a long C chord left to ring.

    ~/Videos/debrief/.venv-music/bin/python video/music.py <total> <turn> <recap> <end>  ->  ~/Videos/patchwars/music/theme.wav
(that venv has tinysoundfont and numpy)
"""

from __future__ import annotations

import os
import sys
import wave

import numpy as np
import tinysoundfont

SR = 48000
BPM = 122
BEAT = 60 / BPM
BAR = 4 * BEAT
SF2 = os.environ.get("HM_SF2", "/usr/share/sounds/sf2/TimGM6mb.sf2")
OUT = os.path.expanduser("~/Videos/patchwars/music")

DRUMS, BASS, PAD, KEYS = 9, 1, 2, 3
KICK, CLAP, HAT, OPEN = 36, 39, 42, 46
C, G, Am, F = (36, (60, 64, 67)), (31, (59, 62, 67)), (33, (57, 60, 64)), (29, (57, 60, 65))
NIGHT = [Am, F, C, G]
DAY = [C, G, Am, F]

Event = tuple[float, int, int, float, int]  # start s, channel, note, length s, velocity


def events(total: float, turn: float, recap: float, end: float) -> list[Event]:
    out: list[Event] = []
    bars = int(total / BAR) + 1
    turn_bar, recap_bar, end_bar = round(turn / BAR), round(recap / BAR), int(end / BAR)
    for b in range(bars):
        t0 = b * BAR
        if b >= end_bar:  # resolve: one last kick and a long C, left to ring
            out.append((t0, DRUMS, KICK, 0.3, 100))
            bass, triad = C
            out.append((t0, BASS, bass, BAR * 2.5, 70))
            for i, n in enumerate((*triad, triad[0] + 12)):
                out.append((t0 + i * 0.05, PAD, n, BAR * 2.5, 70))
                out.append((t0 + i * 0.05, KEYS, n, BAR * 1.2, 58))
            break
        day = b >= turn_bar
        big = b >= recap_bar
        bass, triad = DAY[(b - turn_bar) % 4] if day else NIGHT[b % 4]
        # pad: one held chord per bar, softer in the full groove
        for n in triad:
            out.append((t0, PAD, n, BAR * 0.98, 44 if day else 56))
        if not day:
            # the opening: a muffled kick on every beat from bar 1, closed hats from bar 3
            for beat in range(4):
                if b >= 1:
                    out.append((t0 + beat * BEAT, DRUMS, KICK, 0.2, 62))
                if b >= 3:
                    out.append((t0 + beat * BEAT + BEAT / 2, DRUMS, HAT, 0.1, 38))
            continue
        for beat in range(4):
            tb = t0 + beat * BEAT
            out.append((tb, DRUMS, KICK, 0.2, 108 if big else 100))
            if beat in (1, 3):
                out.append((tb, DRUMS, CLAP, 0.2, 80 if big else 70))
            out.append((tb + BEAT / 2, DRUMS, OPEN if big else HAT, 0.15, 70 if big else 58))
            if big:  # sixteenth hats for the recap
                for k in (1, 3):
                    out.append((tb + k * BEAT / 4, DRUMS, HAT, 0.05, 44))
            # offbeat bass: root, then the octave on the last beat
            out.append((tb + BEAT / 2, BASS, bass + (12 if beat == 3 else 0), BEAT * 0.4, 92 if big else 84))
        # electric-piano stabs on the "and" of 2 and the 4
        for off in (1.5, 3.0):
            for n in triad:
                out.append((t0 + off * BEAT, KEYS, n, BEAT * 0.35, 66 if big else 56))
                if big:
                    out.append((t0 + off * BEAT, KEYS, n + 12, BEAT * 0.35, 56))
    return out


def render(evts: list[Event], seconds: float) -> np.ndarray:
    sf = tinysoundfont._tinysoundfont.SoundFont(SF2)
    sf.set_output(tinysoundfont._tinysoundfont.OutputMode.StereoInterleaved, SR, -6.0)
    sf.channel_set_preset_number(DRUMS, 0, True)
    sf.channel_set_preset_number(BASS, 38, False)  # synth bass 1
    sf.channel_set_preset_number(PAD, 89, False)  # warm pad
    sf.channel_set_preset_number(KEYS, 4, False)  # electric piano 1
    sched = sorted([(s, 1, ch, n, v) for s, ch, n, _, v in evts] + [(s + d, 0, ch, n, 0) for s, ch, n, d, _ in evts])
    total = int(seconds * SR)
    out = np.zeros((total, 2), dtype=np.float32)
    pos, i = 0, 0
    while pos < total:
        nxt = min(max(int(sched[i][0] * SR) if i < len(sched) else total, pos), total)
        if nxt > pos:
            buf = np.zeros((nxt - pos) * 2, dtype=np.float32)
            sf.render(memoryview(buf).cast("B"))
            out[pos:nxt] = buf.reshape(-1, 2)
            pos = nxt
        while i < len(sched) and int(sched[i][0] * SR) <= pos:
            _, on, ch, n, v = sched[i]
            if on:
                sf.channel_note_on(ch, n, v / 127)
            else:
                sf.channel_note_off(ch, n)
            i += 1
    return out


def lowpass_opening(audio: np.ndarray, until: float) -> np.ndarray:
    """The opening sounds like the room through the wall: a one-pole low-pass that opens up at the title."""
    n = min(len(audio), int(until * SR))
    a = np.exp(-2 * np.pi * 900 / SR)
    for ch in range(2):
        y, x = 0.0, audio[:n, ch]
        out = np.empty(n, dtype=np.float32)
        for k in range(n):
            y = (1 - a) * x[k] + a * y
            out[k] = y
        audio[:n, ch] = out * 1.6
    return audio


def main() -> None:
    total, turn, recap, end = (float(x) for x in sys.argv[1:5])
    evts = events(total, turn, recap, end)
    seconds = max(s + d for s, _, _, d, _ in evts) + 2.5
    audio = lowpass_opening(render(evts, seconds), turn)
    audio *= 0.89 / max(1e-6, float(np.abs(audio).max()))
    os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/theme.wav"
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())
    print(f"wrote {path}: {seconds:.1f} s, {len(evts)} notes; title at {turn:.1f} s, recap at {recap:.1f} s, end card at {end:.1f} s")


if __name__ == "__main__":
    main()
