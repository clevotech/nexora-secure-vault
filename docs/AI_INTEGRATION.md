# Nexora AI integration architecture

The Secure Vault now exposes a unified AI workspace modeled around the public Nexora AI feature set: AI chat, image generation, video generation, AI tools, image library, memory, account/settings surfaces, integrations, billing, referrals, administration, support and maintenance.

## Secure backend boundary

The browser/desktop client calls a configurable backend through `VITE_NEXORA_AI_ENDPOINT`. API credentials must remain server-side and must never be embedded in the Vite bundle.

Expected endpoints:

- POST `/chat` — model selection, conversation history, streaming-compatible response
- POST `/image` — image generation
- POST `/video` — video generation/orchestration
- POST `/tools` — summarize, rewrite, translate, extract, analyze, code and research tools
- POST `/memory` — list/save/delete persistent memory
- POST `/voice/transcribe` — authorized voice input
- POST `/voice/speak` — TTS
- POST `/integrations` — connector discovery/management

## Long-form video

The client supports 30–60 seconds, 1–5 minutes, 10–20 minutes, 30–40 minutes and 50–60 minutes. The backend should implement these as orchestrated segments with continuity controls for characters, scenes, voice and reference assets rather than assuming a single model call can render an entire long video.

## Security

- Keep provider/API keys in server-side secrets.
- Authenticate every account-scoped request.
- Apply per-user quotas and rate limits.
- Store only the minimum memory/context required.
- Never log passwords, raw encryption keys, recovery secrets or plaintext vault contents.
- Keep vault encryption client/native-side; AI services should not receive plaintext vault data unless the user explicitly chooses an AI operation that requires it.
- Authorized voice/likeness cloning only; require ownership/consent controls for reference assets.
