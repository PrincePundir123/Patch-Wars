"""The narrator's lines: Chatterbox reads each line in its narrator's voice (refs/female.wav or refs/male.wav, see refs/LICENSES.md);
Whisper transcribes every take and the best match is kept, with its pauses tightened.

    python3 video/synth.py            every line (takes are cached, so a rerun only makes what changed)
    python3 video/synth.py n11 n27    just these lines, with three more seeds each

Out: ~/Videos/patchwars/audio/lines/<id>.wav, lines.json (score, what Whisper heard, length) and words.json
(word times, for captions and for landing beats on spoken words).
"""

from __future__ import annotations

import contextlib
import difflib
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import warnings

warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from narration import WORK, load  # noqa: E402

AUDIO = f"{WORK}/audio"
CACHE = f"{WORK}/takes"
REFS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "refs")
SEEDS = (11, 23, 37)
MORE = (101, 202, 303)
MAX_PAUSE = 0.35
NUM = {"zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"}
SAY = {"eventsub": "event sub", "obs": "o b s", "patch wars": "patch wars"}


def norm(text: str) -> list[str]:
    t = text.lower().replace("’", "'").replace("%", " percent").replace("-", " ")
    for k, v in SAY.items():
        t = re.sub(rf"\b{re.escape(k)}\b", v, t)
    t = re.sub(r"[^a-z0-9' ]", " ", t)
    return [NUM.get(w, w) for w in t.split()]


def score(ref: str, heard: str) -> float:
    return difflib.SequenceMatcher(None, norm(ref), norm(heard)).ratio()


_tts = None
_asr = None


def tts():
    global _tts
    if _tts is None:
        import torch
        from chatterbox.tts import ChatterboxTTS

        with contextlib.redirect_stderr(io.StringIO()):
            _tts = ChatterboxTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
    return _tts


def asr():
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel

        _asr = WhisperModel("small.en", device="cpu", compute_type="int8")
    return _asr


def take(text: str, seed: int, ex: float, cfg: float, voice: str, make: bool = True) -> str | None:
    """One take, cached by everything that shapes it."""
    import soundfile as sf
    import torch

    ref = f"{REFS}/{voice}.wav"
    key = hashlib.sha1(json.dumps([text, seed, ex, cfg, 0.7, hashlib.sha1(open(ref, "rb").read()).hexdigest()]).encode()).hexdigest()[:16]
    path = f"{CACHE}/{key}.wav"
    if not os.path.exists(path) and not make:
        return None
    if not os.path.exists(path):
        torch.manual_seed(seed)
        with contextlib.redirect_stderr(io.StringIO()):
            wav = tts().generate(text, audio_prompt_path=ref, exaggeration=ex, cfg_weight=cfg, temperature=0.7)
        sf.write(path, wav.squeeze(0).numpy(), tts().sr)
    return path


def heard(path: str) -> str:
    segs, _ = asr().transcribe(path, beam_size=5, language="en")
    return " ".join(s.text.strip() for s in segs)


TEMPO = {"female": 1.08, "male": 1.04}


def tighten(src: str, dst: str, tempo: float = 1.0) -> None:
    """Trim both ends; cap every pause inside the line at MAX_PAUSE seconds; optionally quicken it (pitch kept)."""
    af = (
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
        "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,"
        f"silenceremove=stop_periods=-1:stop_threshold=-40dB:stop_duration={MAX_PAUSE}:stop_silence={MAX_PAUSE}"
        + (f",atempo={tempo}" if tempo != 1.0 else "")
    )
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", af, "-ar", "48000", "-ac", "1", dst], check=True)


def duration(path: str) -> float:
    import soundfile as sf

    info = sf.info(path)
    return info.frames / info.samplerate


def main(only: set[str]) -> None:
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(f"{AUDIO}/lines", exist_ok=True)
    report_path = f"{AUDIO}/lines.json"
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}
    asr_cache_path = f"{CACHE}/asr.json"
    asr_cache = json.load(open(asr_cache_path)) if os.path.exists(asr_cache_path) else {}
    for _scene, lid, caption, spoken, ex, cfg, voice in load():
        if only and lid not in only:
            continue
        # Three seeds, plus three more when asked for this line (or already made on an earlier run).
        seeds = SEEDS + tuple(x for x in MORE if only or take(spoken, x, ex, cfg, voice, make=False))
        scored = []
        for seed in seeds:
            path = take(spoken, seed, ex, cfg, voice)
            name = os.path.basename(path)
            if name not in asr_cache:
                asr_cache[name] = heard(path)
                json.dump(asr_cache, open(asr_cache_path, "w"), indent=0)
            scored.append((score(caption, asr_cache[name]), -abs(len(spoken) / max(duration(path), 0.1) - 16), path, asr_cache[name]))
        best = max(scored)
        out = f"{AUDIO}/lines/{lid}.wav"
        tighten(best[2], out, TEMPO[voice])
        report[lid] = {"score": round(best[0], 3), "heard": best[3], "take": os.path.basename(best[2]), "s": round(duration(out), 2), "all": sorted(round(s[0], 3) for s in scored)}
        report[lid]["voice"] = voice
        print(f"{lid:4s} {voice:6s} {report[lid]['s']:5.2f}s  score {best[0]:.2f}  | {best[3]}", flush=True)
    keep = {lid for _, lid, *_ in load()}
    report = {k: v for k, v in report.items() if k in keep}
    json.dump(report, open(report_path, "w"), indent=1)
    print("voice total:", round(sum(r["s"] for r in report.values()), 1), "s")
    words = {}
    for _scene, lid, *_ in load():
        segs, _ = asr().transcribe(f"{AUDIO}/lines/{lid}.wav", beam_size=5, language="en", word_timestamps=True)
        words[lid] = [(w.word.strip(), round(w.start, 3), round(w.end, 3)) for s in segs for w in s.words]
    json.dump(words, open(f"{AUDIO}/words.json", "w"), indent=0)


if __name__ == "__main__":
    main({a for a in sys.argv[1:] if not a.startswith("-")})
