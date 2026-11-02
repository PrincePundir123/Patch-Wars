"""The film's sound effects, synthesised with ffmpeg from nothing: no samples, nothing to license.

    python3 video/sfx.py  ->  ~/Videos/patchwars/sfx/{whoosh,click,riser,hit}.wav (48 kHz stereo)
"""

from __future__ import annotations

import os
import subprocess

OUT = os.path.expanduser("~/Videos/patchwars/sfx")
SOUNDS = {
    # pink noise through a band-pass that sweeps up and back, faded in and out on a soft curve
    "whoosh": ["-f", "lavfi", "-i", "anoisesrc=color=pink:d=0.6:a=0.6",
               "-af", "bandpass=f=1200:w=1.2,afade=t=in:d=0.25:curve=qsin,afade=t=out:st=0.3:d=0.3:curve=qsin,volume=0.9"],
    # a short high tick for a click landing
    "click": ["-f", "lavfi", "-i", "sine=frequency=2200:duration=0.025", "-af", "afade=t=out:st=0.003:d=0.022,volume=0.5"],
    # a rising chirp with a little air, ending on the reveal
    "riser": ["-f", "lavfi", "-i", "aevalsrc='0.25*sin(2*PI*(200*t+300*t*t))':d=1.5",
              "-af", "afade=t=in:d=1.4:curve=exp,highpass=f=150,volume=0.8"],
    # a low hit as a number lands
    "hit": ["-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*(55+80*exp(-30*t))*t)*exp(-6*t)':d=0.9", "-af", "volume=0.9"],
}


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for name, args in SOUNDS.items():
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args, "-ar", "48000", "-ac", "2", f"{OUT}/{name}.wav"], check=True)
    print("wrote", ", ".join(SOUNDS), "to", OUT)


if __name__ == "__main__":
    main()
