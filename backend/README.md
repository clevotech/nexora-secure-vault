# Nexora AI backend boundary

This backend is the server-side execution boundary for Nexora's multi-provider AI workspace. The GitHub Pages client remains static and must never contain provider API keys.

## Implemented baseline

- Provider-neutral model registry for OpenAI, Anthropic, Google Gemini, xAI, DeepSeek and Mistral.
- Task-aware auto-routing for chat, reasoning, coding and research.
- Explicit model selection with backend validation.
- Provider fallback when the selected provider is unavailable or unconfigured.
- Request-size and message validation.
- JSON HTTP API with CORS configuration and health endpoint.
- Provider secrets loaded only from server environment variables.
- No vault passwords, raw keys or plaintext vault contents are accepted by this chat adapter.

## Routes

- POST /chat — live provider-backed routing when a provider is configured.
- POST /image — scaffold; connect an image adapter.
- POST /video — scaffold; connect the long-form job queue/orchestrator.
- POST /tools — scaffold; connect tool execution.
- POST /memory — authenticated development memory store; replace with durable encrypted storage for production.
- POST /credits — authenticated idempotent development credit ledger; connect signed billing webhooks for production.
- POST /voice/transcribe — scaffold; connect authorized transcription.
- POST /voice/speak — scaffold; connect TTS.
- POST /integrations — scaffold; connect connector management.
- GET /health — service health.

## Environment

Use separate provider keys/base URLs:

- NEXORA_OPENAI_API_KEY / NEXORA_OPENAI_BASE_URL
- NEXORA_ANTHROPIC_API_KEY / NEXORA_ANTHROPIC_BASE_URL
- NEXORA_GOOGLE_API_KEY / NEXORA_GOOGLE_BASE_URL
- NEXORA_XAI_API_KEY / NEXORA_XAI_BASE_URL
- NEXORA_DEEPSEEK_API_KEY / NEXORA_DEEPSEEK_BASE_URL
- NEXORA_MISTRAL_API_KEY / NEXORA_MISTRAL_BASE_URL

Set VITE_NEXORA_AI_ENDPOINT in the web deployment to the backend HTTPS origin.

## Production requirements

1. Put the backend behind real authentication before exposing account-scoped features.
2. Apply per-user quotas, rate limits, abuse controls and request tracing without logging secrets.
3. Use durable encrypted storage for memory, image history, billing and referrals.
4. Use a job queue for 1–60 minute video generation; segment, preserve continuity metadata, render and stitch asynchronously.
5. Add signed billing webhooks and idempotent credit accounting.
6. Require consent/ownership controls for voice and likeness references.
7. Keep vault encryption/decryption local/native; plaintext reaches AI only after an explicit user action.
8. Replace wildcard CORS with the exact production web origin.
9. Add provider-specific safety policies and capability checks before enabling image/video/voice routes.

GitHub Pages cannot execute this backend. Deploy it separately on a serverless or container platform and keep all provider credentials there.
