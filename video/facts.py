"""Every number the film says or shows, read from the repository at build time (never typed by hand).

    python3 video/facts.py  ->  ~/Videos/patchwars/build/facts.json
"""

from __future__ import annotations

import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.expanduser("~/Videos/patchwars/build/facts.json")


def run(*cmd: str) -> str:
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=True).stdout


def main() -> None:
    results = open(f"{ROOT}/docs/evaluation/results.md").read()
    evidence = open(f"{ROOT}/docs/codex-evidence.md").read()
    payments = open(f"{ROOT}/packages/shared/src/payments.ts").read()
    tmp = os.path.expanduser("~/Videos/patchwars/build/vitest.json")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    run("npx", "vitest", "run", "--reporter=json", f"--outputFile={tmp}")
    report = json.load(open(tmp))
    bits = [int(b) for b in re.findall(r"bits: (\d+) }", payments)]
    adversarial = re.search(r"Adversarial prompts rejected \| (\d+)/(\d+)", results)
    dupes = re.search(r"Duplicate suppression \| (\d+)/(\d+)", results)
    facts = {
        # Commits in the Codex-built history (the last Codex commit is 49fdd2d; later polish is not counted).
        "commits": int(run("git", "rev-list", "--count", "49fdd2d").strip()),
        "first_commit": run("git", "log", "--reverse", "--format=%ad", "--date=short").split()[0],
        "tests": report["numPassedTests"],
        "test_files": len(report["testResults"]),
        "tests_failed": report["numFailedTests"],
        "thread": re.search(r"\*\*Thread ID:\*\* `([0-9a-f-]+)`", evidence).group(1),
        "adversarial": [int(adversarial.group(1)), int(adversarial.group(2))],
        "duplicates": [int(dupes.group(1)), int(dupes.group(2))],
        "engagements": int(re.search(r"tested in (\d+) cost-matched engagements", results).group(1)),
        "ticks_per_sec": int(re.search(r"Simulation throughput \| (\d+)", results).group(1)),
        "bits_min": min(bits),
        "bits_max": max(bits),
        "bits_avg": sum(bits) / len(bits),
        # Default estimator inputs in apps/web/src/StreamerValue.tsx, and the broadcaster share per Bit there.
        "est": {"viewers": 300, "buyers_pct": 6, "per_buyer": 3, "streams": 12},
        "cents_per_bit": float(re.search(r"STREAMER_CENTS_PER_BIT = ([\d.]+)", open(f"{ROOT}/apps/web/src/StreamerValue.tsx").read()).group(1)),
        "local_ai_win": round(float(re.search(r'"winRate": ([\d.]+)', open(f"{ROOT}/docs/evaluation/local-ai.json").read()).group(1)) * 100),
    }
    facts["log"] = [line.split("|", 1) for line in run("git", "log", "--format=%h|%s", "49fdd2d").strip().splitlines()[:40]]
    e = facts["est"]
    deployments = round(e["viewers"] * e["buyers_pct"] / 100 * e["per_buyer"])
    facts["est_month"] = round(deployments * facts["bits_avg"] * facts["cents_per_bit"] / 100 * e["streams"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(facts, open(OUT, "w"), indent=1)
    print(json.dumps(facts, indent=1))


if __name__ == "__main__":
    main()
