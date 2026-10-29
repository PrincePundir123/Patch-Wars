# Free local AI with Ollama

PATCH WARS can generate real unit blueprints on this computer without an OpenAI key. The local provider uses Ollama's /api/chat API with a bounded JSON schema, no tools, no cloud credentials and no automatic fixture fallback. The existing moderation, schema, resource-efficiency and 200-battle balance gates still apply.

## Setup

1. Install Ollama from https://ollama.com/download if needed.
2. Run `ollama list`. On the development machine, `qwen2.5:3b` is already installed. If missing, `ollama pull qwen2.5:3b` downloads the model (about 1.9 GB).
3. Put these settings in the ignored local `.env`:

```dotenv
FORGE_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
FORGE_TIMEOUT_MS=120000
```

4. Keep Ollama running. Restart PATCH WARS, reconnect Twitch, and create a live match. Demo rooms deliberately continue using fixtures.
5. Run `pnpm verify:local-ai "A sturdy guardian that starts with a protective shield"` for a real local generation and balance check. This uses local compute, not a paid API. It makes at most two attempts and saves successful evidence to `docs/evaluation/local-ai.json`.

## Live rehearsal

Start battle, send `!forge A sturdy guardian that starts with a protective shield` in real Twitch chat, close proposals using the operator control, vote with `!vote p1`, then close voting. On a CPU, generation may take a minute. Pause the battle while the Forge works so the match cannot finish first. Worker generation continues during a pause. When approved, resume: the three-second deployment countdown runs in simulation time. Record both the actual generation time and the provider label honestly.

Initial tests on this 16 GB Intel UHD machine rejected two splitting-slime drafts for schema errors; after tightening the schema, two more were rejected at 0% balance wins. A guardian concept then passed on the second attempt: 42% wins across 200 engagements, approximately 56 seconds including both attempts and balance. This is one successful concept, not a broad model-quality benchmark. New concepts may still fail validation or balance, and rejection is expected behavior.

## Boundaries

Only loopback HTTP origins are accepted; redirects, URL credentials and cloud model names are rejected. Responses are capped at 64 KB, blueprints at 10 KB and generation at 1,600 output tokens per attempt. Worker timeouts and room quotas also apply. A model failure stays visible; it is never relabelled as successful fixture generation. Host Ollama beside the backend if deploying this provider; do not expose its unauthenticated port publicly.

Sources: https://docs.ollama.com/api/chat and https://docs.ollama.com/capabilities/structured-outputs (checked October 29, 2026 using Exa).
