# The PATCH WARS demo film

Everything in the film is rebuilt from code. Outputs go to `~/Videos/patchwars/` (not committed).

```sh
pnpm dev                                  # the app the screen flows record
python3 video/facts.py                    # every number, read from the repo
python3 video/synth.py                    # narration takes (Chatterbox), best take kept by Whisper match
for f in hero spawn forge earn sigil; do node video/record.mjs $f; done
python3 video/build.py timeline           # scene starts from the real voice lengths
python3 video/build.py stills
python3 video/build.py gfx                # graphics.html and three.html scenes, recorded to exact length
python3 video/sfx.py                      # whoosh, click, riser, hit (synthesized with ffmpeg)
python3 video/build.py film               # final/PatchWars-film.mp4, 720p copy, .srt and chapters
```

- `narration.py`: every line as data (caption, spoken text, voice settings).
- `record.mjs`: Chrome screencast of real app flows (JPEG q92), exact-timed MP4 plus marks.
- `graphics.html`: opening, title, Extension and live-Twitch stills, Codex stats, recap, end card.
- `three.html`: the 3D "under the hood" stack (three.js r128 from cdnjs).
- `music.py`: one theme composed in code and rendered from a General MIDI SoundFont.
- `thumbnail.html`: YouTube and Devpost thumbnails, screenshotted with Playwright.

The narrator reference `refs/male.wav` is a recording the project owner supplied for narration. It is kept out of git
(see `.gitignore`); put your own licensed reference there to rebuild. Simulated chat and fixture Forge output are
labelled on screen.
