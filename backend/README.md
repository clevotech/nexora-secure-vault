# Nexora AI backend boundary

This backend is the server-side execution boundary for Nexora's multi-provider AI workspace. The GitHub Pages client remains static and must never contain provider API keys.

## Implemented baseline

- Provider-neutral model registry for OpenAI, Anthropic, Google Gemini, xAI, DeepSeek and Mistral.
- Task-aware auto-routing for chat, reasoning, coding and research.
- Explicit model selection with backend validation and provider fallback.
- Server-side provider secrets.
- JWT/OIDC authentication with issuer, audience and remote JWKS verification; development auth is explicit and opt-in.
- Authenticated, user-scoped memory API with PostgreSQL persistence when `DATABASE_URL` is configured, plus an in-memory development fallback.
- PostgreSQL credit ledger with idempotency and per-user transactional serialization.
- PostgreSQL job queue with transactional `FOR UPDATE SKIP LOCKED` claiming for worker processes.
- Route-specific request limits, including a larger transcription envelope compatible with the provider's documented 25 MB audio-file limit.
- JSON HTTP API with configured-origin CORS and health endpoint.
- No vault passwords, raw keys or plaintext vault contents are accepted by the chat adapter.

## Routes

- POST /chat — provider-backed routing when a provider is configured.
- POST /image — live OpenAI GPT Image adapter when configured.
- POST /video — intentionally provider-neutral scaffold; long-form generation needs an active video provider/worker.
- POST /tools — scaffold.
- POST /memory — authenticated memory API; PostgreSQL when configured.
- POST /credits — authenticated idempotent credit ledger.
- POST /voice/transcribe — live OpenAI transcription adapter when configured.
- POST /voice/speak — live OpenAI speech adapter when configured.
- POST /jobs — authenticated job creation/read API backed by the durable queue when PostgreSQL is configured.
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

Authentication:

- NEXORA_AUTH_ISSUER — production OIDC issuer.
- NEXORA_AUTH_AUDIENCE — expected JWT audience.
- NEXORA_DEV_AUTH — explicit local-development bypass only; keep false in production.
- NEXORA_CORS_ORIGIN — one or more exact allowed web origins, comma-separated.

Persistence:

- DATABASE_URL — PostgreSQL connection string.
- NEXORA_DB_POOL_MAX — maximum application pool size; defaults to 10.

Set VITE_NEXORA_AI_ENDPOINT in the web deployment to the backend HTTPS origin.

## Production requirements still outstanding

1. Deploy the backend behind HTTPS and configure a real OIDC provider using the issuer/audience settings above.
2. Run PostgreSQL in production and verify backups, migrations and connection limits.
3. Deploy a worker process that calls the PostgreSQL job claim operation and executes approved media adapters; do not expose queue-claiming directly to browser clients.
4. Add object storage for generated media and return signed, time-limited URLs instead of keeping large results in API responses.
5. Keep video provider-neutral until a currently supported provider is selected; do not wire Nexora to a retired video API.
6. Add signed billing webhooks, quotas and durable credit accounting rules for every paid operation.
7. Require consent/ownership controls for voice and likeness references.
8. Keep vault encryption/decryption local/native; plaintext reaches AI only after an explicit user action.
9. Add provider-specific safety, rate limits, quotas and observability.

GitHub Pages cannot execute this backend. Deploy it separately on a serverless or container platform and keep all provider credentials there.
