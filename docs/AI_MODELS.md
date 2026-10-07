# Nexora AI multi-model routing

Nexora is provider-neutral. The browser sends a logical model identifier to the secure backend; provider credentials and routing stay server-side.

## Supported provider adapters

| Provider | Model examples | Primary strengths |
|---|---|---|
| OpenAI | GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna | Frontier reasoning, coding, vision, tools |
| Anthropic | Claude Opus 5.5, Claude Fable 5.1, Claude Sonnet 5.5 | Long-running agents, knowledge work, reasoning |
| Google | Gemini 3.8 Flash, Gemini 3.8 Live | Multimodal work, agents, realtime voice |
| xAI | Grok 4.7 | Reasoning, coding, realtime/web-connected workflows |
| DeepSeek | DeepSeek-V4-Pro, DeepSeek-V4-Flash | Cost-efficient reasoning and agent workloads |
| Mistral | Mistral Large 4, Mistral Medium 3.5, Devstral 2 | Multimodal, coding and open-weight deployments |

These model names should be treated as configurable provider mappings, not hard-coded secrets or irreversible dependencies. Providers change model aliases and deprecations, so the backend should maintain a versioned model registry and health checks.

## Router policy

The auto router should select a model based on task, latency target, context size, modality, cost ceiling and provider health.

Suggested routing:

- Deep reasoning / complex planning → highest-quality reasoning model available.
- Coding / repository work → strongest coding/agent model available.
- Long documents / multimodal analysis → provider with sufficient context and modality.
- Image generation → dedicated image model rather than text model.
- Voice → realtime/audio provider.
- Research → model with server-side web/search tooling.
- High-volume simple tasks → fast/low-cost model.
- Provider outage → fail over to a compatible healthy provider.

The router should record provider/model, latency, token usage and failure category in operational telemetry, but never record passwords, encryption keys, recovery phrases or plaintext vault contents.

## Important

The frontend must never call these providers directly with secret API keys. It only calls VITE_NEXORA_AI_ENDPOINT. The backend owns authentication, routing, quotas, billing, retries, safety policy and provider credentials.
