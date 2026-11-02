"""The narrator's lines, as data, with every number read from facts.json (video/facts.py).

Each line: (scene, id, caption, spoken, exaggeration, cfg_weight, voice). The caption is what the screen shows; the
spoken text is what the voice reads (numbers in words, names spelled for the voice). One narrator for the whole film.
"""

from __future__ import annotations

import json
import os

WORK = os.path.expanduser("~/Videos/patchwars")
FACTS = f"{WORK}/build/facts.json"

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def words(n: int) -> str:
    """A whole number from 0 to 9999 as the voice should say it."""
    if n >= 1000:
        rest = n % 1000
        return ONES[n // 1000] + " thousand" + ("" if rest == 0 else " " + words(rest))
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    rest = n % 100
    return ONES[n // 100] + " hundred" + ("" if rest == 0 else " and " + words(rest))


OPEN = (0.6, 0.35)
PRODUCT = (0.7, 0.4)
LIFT = (0.9, 0.3)
V = "male"


def lines(f: dict) -> list[tuple[str, str, str, str, float, float, str]]:
    e = f["est"]
    out = [
        ("open", "n01", "Every night, a Twitch chat fills up with people who care.", "Every night, a Twitch chat fills up with people who care.", *OPEN),
        ("open", "n02", "They type. They cheer. They spam emotes.", "They type. They cheer. They spam emotes.", *OPEN),
        ("open", "n03", "And almost nothing they type changes what happens on stream.", "And almost nothing they type changes what happens on stream.", *OPEN),
        ("open", "n04", "What if chat didn't just watch? What if it played?", "So what if chat didn't just watch? What if it played?", *OPEN),
        ("title", "n05", "This is PATCH WARS.", "This is Patch Wars.", *PRODUCT),
        ("title", "n06", "Chat commands an army, invents its warriors, and backs its side with Bits.", "A live strategy game where chat commands an army, invents its warriors, and backs its side with Bits.", *PRODUCT),
        ("spawn", "n07", "Viewers type commands right in Twitch chat.", "Here's a stream. Viewers type commands right in Twitch chat.", *PRODUCT),
        ("spawn", "n08", "The server checks each message really came from Twitch, drops duplicates, and a soldier marches out.", "The server checks each message really came from Twitch, drops duplicates, and a soldier marches out.", *PRODUCT),
        ("spawn", "n09", "Two communities, Ember and Azure, fight over one lane, in a battle every viewer sees the same.", "Two communities, Ember and Azure, fight over one lane, in a battle every viewer sees the same.", *PRODUCT),
        ("forge", "n10", "Then chat goes further. Anyone can propose a new warrior, and every viewer gets one vote.", "Then chat goes further. Anyone can propose a new warrior, and every viewer gets one vote.", *PRODUCT),
        ("forge", "n11", "An AI drafts the winner as data, in a small ability language. Any draft that tries to be code is rejected.", "An A I drafts the winner as data, in a small ability language. Any draft that tries to be code is rejected.", *PRODUCT),
        ("forge", "n12", f"Then it fights {f['engagements']} test battles. Too strong or too weak, and it never ships.", f"Then it fights {words(f['engagements'])} test battles. Too strong or too weak, and it never ships.", *PRODUCT),
        ("forge", "n13", "This one passed. It gets a crest drawn in code from its blueprint, and it enters the match.", "This one passed. It gets a crest drawn in code from its blueprint, and it enters the match.", *PRODUCT),
        ("forge", "n14", "When the Prism Slime falls, it splits into three. Chat just changed the rules.", "When the Prism Slime falls, it splits into three. Chat just changed the rules.", *PRODUCT),
        ("earn", "n15", "And streamers earn from it.", "And streamers earn from it.", *PRODUCT),
        ("earn", "n16", f"Through the Twitch Extension, a viewer drops a soldier for {f['bits_min']} to {f['bits_max']} Bits, and the whole stream sees it land.", f"Through the Twitch Extension, a viewer drops a soldier for {words(f['bits_min'])} to {words(f['bits_max'])} Bits, and the whole stream sees it land.", *PRODUCT),
        ("earn", "n17", f"{e['viewers']} viewers, {e['buyers_pct']}% buying {e['per_buyer']} soldiers a stream: about ${f['est_month']} a month for the streamer.", f"{words(e['viewers'])} viewers, {words(e['buyers_pct'])} percent buying {words(e['per_buyer'])} soldiers a stream. That's about {words(f['est_month'])} dollars a month for the streamer.", *PRODUCT),
        ("earn", "n18", "Bits checkout is built and tested. It switches on once Twitch approves the extension.", "Bits checkout is built and tested. It switches on once Twitch approves the extension.", *PRODUCT),
        ("collab", "n19", "Collabs get better too. Two streamers, two castles, each chat holding its own side.", "Collabs get better too. Two streamers, two castles, each chat holding its own side.", *PRODUCT),
        ("collab", "n20", "Every big moment has its own sound, synthesized live in the browser.", "Every big moment has its own sound, synthesized live in the browser.", *PRODUCT),
        ("live", "n21", "And this is a real match on a real Twitch channel, with Twitch's own chat inside the game.", "And this is a real match on a real Twitch channel, with Twitch's own chat inside the game.", *PRODUCT),
        # Used instead of n21 when a real Twitch recording is in ~/Videos/patchwars/real/twitch.mp4.
        ("real", "r1", "Now, live on a real Twitch channel.", "Now, live on a real Twitch channel.", *PRODUCT),
        ("real", "r2", "A viewer types spawn archer in Twitch chat, and the archer marches out on stream.", "A viewer types spawn archer in Twitch chat, and the archer marches out on stream.", *PRODUCT),
        ("real", "r3", "No sign-up, no extension. Just chat.", "No sign up, no extension. Just chat.", *PRODUCT),
        ("hood", "n22", "Under the hood, Twitch events arrive through EventSub, and an adapter verifies every source.", "Under the hood, Twitch events arrive through event sub, and an adapter verifies every source.", *PRODUCT),
        ("hood", "n23", "The Forge drafts. The safety gate stops any code. Only the idea gets through.", "The Forge drafts. The safety gate stops any code. Only the idea gets through.", *PRODUCT),
        ("hood", "n24", "The balance lab tests it, and the arena streams the result to OBS and every viewer.", "The balance lab tests it, and the arena streams the result to O B S and every viewer.", *PRODUCT),
        ("codex", "n25", "We built almost all of this in one Codex thread.", "We built almost all of this in one Codex thread.", *PRODUCT),
        ("codex", "n26", f"Codex built the engine, the Twitch adapter, the Forge, the server and the Extension, across {f['commits']} commits.", f"Codex built the engine, the Twitch adapter, the Forge, the server and the extension, across {words(f['commits'])} commits.", *PRODUCT),
        ("codex", "n27", f"{f['tests']} tests pass. Codex caught invalid model drafts and weak balance before they shipped.", f"{words(f['tests'])} tests pass. Codex caught invalid model drafts and weak balance before they shipped.", *PRODUCT),
        ("codex", "n28", f"{f['adversarial'][0]} of {f['adversarial'][1]} prompt attacks rejected. {f['duplicates'][0]:,} of {f['duplicates'][1]:,} duplicate messages dropped.", f"{words(f['adversarial'][0])} of {words(f['adversarial'][1])} prompt attacks rejected. {words(f['duplicates'][0])} of {words(f['duplicates'][1])} duplicate messages dropped.", *PRODUCT),
        ("recap", "n29", "Chat commands the army.", "Chat commands the army.", *LIFT),
        ("recap", "n30", "Chat invents the warriors.", "Chat invents the warriors.", *LIFT),
        ("recap", "n31", "Every warrior is tested before it fights.", "Every warrior is tested before it fights.", *LIFT),
        ("recap", "n32", "Bits become soldiers on screen.", "Bits become soldiers on screen.", *LIFT),
        ("recap", "n33", "Two streams. One battlefield.", "Two streams. One battlefield.", *LIFT),
        ("close", "n34", "Your chat was always ready to play. Now it can.", "Your chat was always ready to play. Now it can.", *OPEN),
        ("close", "n35", "PATCH WARS. Built with Codex, for Twitch.", "Patch Wars. Built with Codex, for Twitch.", *PRODUCT),
    ]
    return [(s, i, c, sp, ex, cfg, V) for s, i, c, sp, ex, cfg in out]


def load() -> list[tuple[str, str, str, str, float, float, str]]:
    return lines(json.load(open(FACTS)))


if __name__ == "__main__":
    total = 0
    for s, i, c, sp, *_ in load():
        total += len(sp.split())
        print(i, s, c)
    print("spoken words:", total)
