# LiteRT Chat — Backend Cloud Binding

This document describes how the **Lite Chat portal** (`client/src/pages/LiteChat.tsx`)
binds its cloud provider/model configuration to the AICodex backend, so the Cloud
mode actually resolves real LLM providers instead of a hardcoded client catalog.

## Overview

```
LiteChat.tsx (composer, cloud config UI)
        │
        ▼
useLiteRtChat.ts  ── POST /api/chat/cloud-config  ──►  backend/api/chat.py
        │         (per-provider config + live listing)
        │
        ▼
useLiteRtChat.ts  ── POST /api/chat/quick          ──►  backend/api/chat.py
        │                                                 └─► backend/agent/models.py get_llm()
        ▼
backend LLM SDKs (OpenAI-compatible, Google GenAI, Ollama Cloud, Cloudflare…)
```

## Backend

### `POST /api/chat/cloud-config`

Returns the cloud provider + model catalog for the Lite Chat portal.

- Iterates over `LITE_CLOUD_PROVIDERS` (defined in `backend/api/chat.py`):
  `ollama_cloud`, `groq`, `openrouter`, `gemini`, `anthropic`, `azure`,
  `cloudflare_ai_gateway`, `workers_ai`, `colab_bridge`, plus the "More
  Providers" set: `deepseek`, `xai`, `together`, `fireworks`, `nvidia`,
  `perplexity`, `cohere`, `mistral`, `huggingface`, `cerebras`.
- For each provider it attempts a **live listing** via the existing
  `_list_models_raw()` helper in `backend/api/models.py`, forwarding the
  per-provider `api_key` / `base_url` / `account_id` / `gateway_id` the frontend
  sent in the request body (mirroring the headers the Workspace UI sends to
  `/api/models`).
- **There is no curated fallback catalog.** A provider that can't be live-listed
  (missing key, unreachable host, or missing connection params) simply returns an
  empty model list with `"source": "none"`. The portal UI surfaces the real
  blocker — e.g. telling the user to save an API key — instead of showing models
  that would fail when used.
- Response shape:

```json
{
  "providers": [
    { "id": "ollama_cloud", "models": [ { "id": "llama3", "name": "Llama 3" }, ... ], "source": "live" },
    { "id": "groq", "models": [], "source": "none" }
  ]
}
```

`source` is `"live"` when models came from the provider API and `"none"`
when the live listing returned nothing (missing key / unreachable / missing
connection params).

### `POST /api/chat/quick`  (enhanced)

Existing lightweight chat endpoint, now enhanced to:

- Forward connection params: `base_url`, `account_id`, `gateway_id` to
  `get_llm()` so Ollama Cloud URLs, Cloudflare AI Gateway / Workers AI account
  & gateway IDs, and Colab bridge URLs resolve correctly.
- Resolve an API key from the user's saved `settings_json.api_keys` when the
  client does not send one explicitly.
- **Guard**: for providers that require a key (`groq`, `openrouter`, `gemini`,
  `anthropic`, `azure`, `cloudflare_ai_gateway`, `workers_ai`, `deepseek`,
  `xai`, `together`, `fireworks`, `nvidia`, `perplexity`, `cohere`, `mistral`,
  `huggingface`, `cerebras`) with no key available, it returns a clear
  "No API key saved for provider …" reply instead of hitting the upstream API
  with a dummy key.
- Builds the LLM client via `backend/agent/models.py → get_llm(provider, model, …)`
  and streams a single non-streamed reply.

> Note: the `litert` provider is **client-side only** — `get_llm()` refuses to
> serve it (`ValueError`). The Lite Chat portal handles local inference directly
> in the browser; the backend only handles cloud providers.

## Frontend

### `client/src/config/providerConfig.ts`  (shared source of truth)

Centralizes per-provider credential/connection resolution so the Workspace UI
and the Lite Chat portal behave identically:

- **`getProviderApiKey(prov)`** — reads the per-provider key from `localStorage`
  (`groq_api_key`, `workers_ai_key`, `${id}_api_key`, …).
- **`getProviderConnectionParams(prov)`** — reads `base_url` / `account_id` /
  `gateway_id` for Ollama Cloud, Colab bridge, Cloudflare AI Gateway, Workers AI,
  and the More Providers.
- **`ALL_CLOUD_PROVIDERS`** — the full cloud provider list (minus client-side
  `local` / `litert`).

Used by `AIContext.getApiKey`, `Workspace.getProviderConnectionParams`,
`ProviderSelector.fetchModels`, and `useLiteRtChat`.

### `client/src/hooks/useLiteRtChat.ts`

- **`cloudModels` state**: hydrated live from `POST /api/chat/cloud-config` on
  mount — there is **no bundled fallback catalog**. When the endpoint is
  unreachable, `cloudModels` stays empty and `cloudConfigSource` is set to
  `"fallback"`.
- **`buildProviderConfig()`**: builds the per-provider `{ api_key, base_url,
  account_id, gateway_id }` map from the shared `providerConfig` helpers and
  sends it in the `cloud-config` body (so Workers AI & co. can be live-listed).
- **`cloudProviderStatus` state**: `Record<provider, 'live' | 'none'>` — reflects
  each provider's `source` from the backend so the UI can distinguish "no models
  loaded" from "needs configuration".
- **`missingApiKey`**: `true` when the selected provider is in
  `PROVIDERS_REQUIRING_KEY` and no key is saved in `localStorage`. Surfaced as a
  warning notice in `LiteChat.tsx` and used to pick the model-dropdown placeholder.
- **`cloudConfigSource` state**: `"backend"` | `"fallback"` — surfaced in the
  footer telemetry strip of `LiteChat.tsx`.
- **`getProviderApiKey` / `getProviderConnectionParams`** (shared module) are used
  to build the `/chat/quick` body, matching Workspace's conventions.

### `client/src/pages/LiteChat.tsx`

- Provider `<select>` lists every cloud provider (`PROVIDERS` + `MORE_PROVIDERS`,
  minus `local`/`litert`) regardless of model availability.
- When the selected provider has no loaded models, the model `<select>` shows a
  placeholder explaining why (`Add your API key to load models` when
  `missingApiKey`, otherwise `No models loaded`).
- A warning notice renders above the composer when `missingApiKey` is true,
  telling the user to configure the API key for the selected provider.
- Composer sends the selected `provider`, `activeModelId`, `api_key`, and
  connection params to the backend.
- Footer strip shows the cloud config source badge (`Cloud Config: Live` vs
  `Cloud Config: Fallback`).

## Configuration / localStorage keys

| Purpose                     | localStorage key                                  |
| --------------------------- | ------------------------------------------------- |
| Groq API key                | `groq_api_key`                                    |
| OpenRouter API key          | `openrouter_api_key`                              |
| Gemini API key              | `gemini_api_key`                                  |
| Ollama Cloud key            | `ollama_cloud_key`                                |
| Ollama Cloud base URL       | `ollama_cloud_url`                                |
| Cloudflare AI Gateway key   | `cloudflare_ai_gateway_key`                       |
| Cloudflare AI Gateway URL   | `cloudflare_ai_gateway_url`                       |
| Cloudflare account ID       | `cloudflare_ai_gateway_account_id`                |
| Cloudflare gateway ID       | `cloudflare_ai_gateway_gateway_id`                |
| Workers AI key              | `workers_ai_key`                                  |
| Workers AI account ID       | `workers_ai_account_id`                           |
| Colab bridge URL            | `colab_bridge_url`                                |
| Anthropic API key           | `anthropic_api_key`                               |
| Azure API key               | `azure_api_key`                                   |
| DeepSeek / xAI / Together / Fireworks / NVIDIA / Perplexity / Cohere / Mistral / Hugging Face / Cerebras key | `${id}_api_key` |
| Custom base URL (any More Provider) | `${id}_base_url`                           |

## Files touched

- `backend/api/chat.py` — `cloud-config` endpoint (POST, forwards per-provider config; live-only, no curated fallback), `quick` enhancements + missing-key guard
- `backend/api/models.py` — More-Providers OpenAI-compatible live listing + env key fallbacks
- `backend/agent/models.py` — `get_llm` routing for More Providers (OpenAI-compatible, Anthropic, Azure)
- `client/src/config/providerConfig.ts` — **new** shared provider credential/connection module (single source of truth)
- `client/src/contexts/AIContext.tsx` — `getApiKey` delegates to shared `providerConfig`
- `client/src/pages/Workspace.tsx` — `getProviderConnectionParams` delegates to shared `providerConfig`
- `client/src/components/ProviderSelector.tsx` — uses shared `providerConfig` for model-fetch headers
- `client/src/components/providerMeta.ts` — `workers_ai` label renamed to "Cloudflare Workers AI"
- `client/src/hooks/useLiteRtChat.ts` — live-only backend hydration (POST config), missing-key detection, shared helpers
- `client/src/pages/LiteChat.tsx` — all providers listed, missing-key notice + model placeholder, config source badge
- `client/src/components/MoreProvidersModal.tsx` — imports shared `MORE_PROVIDERS` from `providerMeta`
