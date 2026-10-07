# Nexora AI backend boundary

This backend is the server-side execution boundary for Nexora's multi-provider AI workspace. The GitHub Pages client remains static and must never contain provider API keys.

## Implemented baseline

- Provider-neutral model registry for OpenAI, Anthropic, Google Gemini, xAI, DeepSeek and Mistral.
- Task-aware auto-routing for chat, reasoning, coding and research.
- Explicit model selection with backend validation and provider fallback.
- Server-side provider secrets.
- Authenticated, user-scoped memory API with PostgreSQL persistence when `DATABASE_URL` is configured, plus an in-memory development fallback.
- Route-specific request limits, including a larger transcription envelope compatible with the provider's documented 25 MB audio-file limit.
- JSON HTTP API with configurable CORS and health endpoint.
- No vault passwords, raw keys or plaintext vault contents are accepted by the chat adapter.

## Routes

- POST /chat — provider-backed routing when a provider is configured.
- POST /image — live OpenAI GPT Image adapter when configured.
- POST /video — intentionally provider-neutral scaffold; long-form generation needs an active video provider/queue.
- POST /tools — scaffold.
- POST /memory — authenticated memory API; PostgreSQL when configured.
- POST /credits — authenticated idempotent development credit ledger; production billing webhooks still required.
- POST /voice/transcribe — live OpenAI transcription adapter when configured.
- POST /voice/speak — live OpenAI speech adapter when configured.
- POST /jobs — authenticated job-state API; a durable worker/queue is still required for production asynchronous execution.
- POST /integrations — scaffold.
- GET /health — service health and current memory-storage mode.

## Environment

Provider keys/base URLs:

- NEXORA_OPENAI_API_KEY / NEXORA_OPENAI_BASE_URL
- NEXORA_ANTHROPIC_API_KEY / NEXORA_ANTHROPIC_BASE_URL
- NEXORA_GOOGLE_API_KEY / NEXORA_GOOGLE_BASE_URL
- NEXORA_XAI_API_KEY / NEXORA_XAI_BASE_URL
- NEXORA_DEEPSEEK_API_KEY / NEXORA_DEEPSEEK_BASE_URL
- NEXORA_MISTRAL_API_KEY / NEXORA_MISTRAL_BASE_URL

Persistence:

- DATABASE_URL — PostgreSQL connection string.
- NEXORA_DB_POOL_MAX — maximum application pool size; defaults to 10.

Set VITE_NEXORA_AI_ENDPOINT in the web deployment to the backend HTTPS origin.

## Production requirements still outstanding

1. Configure a real JWT/OIDC verifier and issuer/audience; the current development auth remains fail-closed.
2. Add durable user/account tables and move credits/jobs from process memory into PostgreSQL.
3. Add a real queue/worker and object storage for asynchronous media results.
4. Keep video provider-neutral until a currently supported provider is selected; do not wire Nexora to a retired video API.
5. Add signed billing webhooks and durable idempotent credit accounting.
6. Require consent/ownership controls for voice and likeness references.
7. Keep vault encryption/decryption local/native; plaintext reaches AI only after an explicit user action.
8. Replace wildcard CORS with the exact production web origin.
9. Add provider-specific safety, rate limits, quotas and observability.

GitHub Pages cannot execute this backend. Deploy it separately on a serverless or container platform and keep all provider credentials there.
