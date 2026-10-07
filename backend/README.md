# Nexora AI backend boundary

The web client is intentionally static and never contains provider API keys. Deploy the backend separately and set `VITE_NEXORA_AI_ENDPOINT` to its public HTTPS base URL.

## Required routes

- POST /chat
- POST /image
- POST /video
- POST /tools
- POST /memory
- POST /voice/transcribe
- POST /voice/speak
- POST /integrations

## Production requirements

1. Authenticate every request and scope data to the authenticated user.
2. Keep model/provider keys in server-side secrets only.
3. Apply per-user quotas, rate limits and abuse controls.
4. Validate request size, file/reference asset types and output limits.
5. Never log passwords, vault keys, recovery phrases or plaintext vault contents.
6. Treat voice/likeness references as consent-controlled assets.
7. Keep vault encryption/decryption local/native; send plaintext to AI only after an explicit user action.
8. Use durable encrypted storage for persistent memory, image history, billing records and referral records.
9. Use a job queue for long video generation. A 1–60 minute request should be segmented and stitched with continuity metadata, not treated as one synchronous model call.
10. Verify webhook signatures for billing and asynchronous generation providers.

The repository does not ship provider credentials or pretend that GitHub Pages can execute these server-side routes. GitHub Pages hosts the static client; the backend must be deployed to a serverless/container platform with secrets configured there.


## Provider registry baseline

Configure adapters for OpenAI, Anthropic, Google Gemini, xAI, DeepSeek and Mistral. Keep the registry server-side so models can be upgraded, retired or rerouted without rebuilding the client. Provider selection from the UI is a preference; the backend remains authoritative for availability, safety, quota and fallback.
