# Implementation Plan — Colab Provider & Llama.cpp Orchestration Integration

This plan outlines the integration of the Colab Bridge provider and the standardization on the llama.cpp / OllamaOpt pipeline (deprecating the Ollama App background service) across the AI_Codex ecosystem.

## User Review Required

> [!IMPORTANT]
> **Ollama App Deprecation & Unification under llama.cpp**:
> To ensure consistent model orchestration between local development and Google Colab environments, we are forgoing the Ollama App daemon in favor of the **OllamaOpt-Llama.cpp** (llama-server) pipeline.
> - **Model Source**: GGUF models will be loaded directly from Google Drive persistent storage (`/content/drive/MyDrive/open_models/` in Colab, or local folders).
> - **Inference Server**: We will run pre-compiled `llama-server` binaries in both environments, communicating with our backend via standard OpenAI-compatible API requests.

Please verify if this unified orchestration strategy aligns with your expectations.

## Proposed Changes

---

### Backend Components

#### [MODIFY] [config.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/config.py)
- Change default `LOCAL_BACKEND_MODE` configuration from `"ollama"` to `"llamacpp"`.

#### [MODIFY] [models.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/models.py)
- Support `colab_bridge` in `_list_models_raw`.
- For `colab_bridge`, attempt to query the custom base URL's `/v1/models` endpoint (OpenAI format) first.
- If that fails, query the `/api/tags` endpoint (Ollama format).
- If both fail, return a default fallback model `gemma-4-E4B_q4_0-it` (Gemma 4 QAT) to avoid blocking the user.

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- Support `colab_bridge` in `get_dynamic_llm`.
- If `base_url` is provided in the configuration, instantiate `ChatOpenAI` pointing to the custom base URL with the handshake key.
- If no custom base URL is provided, fall back to the existing WebSocket `ChatBridge` implementation.

#### [MODIFY] [models.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/models.py)
- Map `colab_bridge` in `get_llm` to return `ChatOpenAI` pointing to the configured default or local LLM base URL as a generic fallback.

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
- Inject the missing `"api_keys": api_keys` into the second `config` dictionary instantiation (line 318) within the WebSocket chat handler to enable dynamic fallbacks.

---

### Colab Deployment Notebook

#### [MODIFY] [AICodex_Spirit_Bird.ipynb](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/notebooks/AICodex_Spirit_Bird.ipynb)
- Deprecate Ollama App download and initialization cells.
- Replace the Ollama App installer cell with a cell that downloads precompiled `llama-server` for Ubuntu.
- Start `llama-server` in the background, pointing to the persistent Gemma 4 GGUF model located at `/content/drive/MyDrive/open_models/Google/gemma-4-E4B_q4_0-it.gguf`.
- Inject `LOCAL_BACKEND_MODE=llamacpp` and `LLAMACPP_BASE_URL=http://localhost:8080` environment variables into the backend Uvicorn startup cell.

---

### VSCode Extension Components

#### [MODIFY] [chatView.html](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/chatView.html)
- Add `<option value="colab_bridge">Colab Bridge</option>` to the `setting-provider` dropdown.
- Register `key-group-colab_bridge` inside the `group-provider-keys` block containing:
  - Input field for `url-colab-bridge` (Base URL).
  - Input field for `key-colab-bridge` (Handshake Key/Secret).
- Update settings loaders and savers (`saveSettings`, `updateProviderKeyVisibility`, `loadSettings` handler) to manage `colab_bridge` settings.
- In `fetchModels`, extract the provider-specific API key and send it as `providerKey` in the `fetchModels` postMessage payload.

#### [MODIFY] [ChatViewProvider.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/ChatViewProvider.ts)
- Read and save `colab_bridge` custom keys (`colab_bridge` and `colab_bridge_url`) inside the `apiKeys` configuration record.
- In `handleUserMessage`, resolve `base_url` to `colab_bridge_url` if the selected provider is `colab_bridge`.
- In `handleFetchModels`, extract `providerKey` and set it as the `X-API-Key` header, and set `X-Base-Url` if `ollamaCloudUrl` (which now receives `colab_bridge_url` when the provider is `colab_bridge`) is set.

---

### Web Client Components

#### [MODIFY] [providerMeta.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/providerMeta.ts)
- Update `colab_bridge` provider metadata to map the LobeHub brand `'Colab'` and set `iconType` to `'inline'`.

#### [MODIFY] [ProviderIcon.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ProviderIcon.tsx)
- Enhance brand icon resolution: check for `Component.Color || Component` to correctly render the Colab color logo from `@lobehub/icons`.

#### [MODIFY] [SettingsModal.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/SettingsModal.tsx)
- Render custom inputs for Colab Bridge URL and Colab Bridge Handshake Key/Secret when the active provider is `colab_bridge`.
- Read and write these settings to `localStorage` under `colab_bridge_url` and `colab_bridge_key`.

#### [MODIFY] [ProviderSelector.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ProviderSelector.tsx)
- Update `fetchModels` to query the backend models endpoint if `colab_bridge_url` is configured in `localStorage`, appending `X-Base-Url` and `X-API-Key` headers.
- Fall back to the WebSocket-based `bridgeModels` if no custom URL is configured.

## Verification Plan

### Automated/Unit Testing
- Run backend checks to verify models endpoint and agent initialization correctness.

### Manual Verification
- Open the VSCode Settings panel, configure the Colab Bridge custom provider, and fetch available models.
- Open the Web Client settings modal, input custom Colab Bridge endpoints, and verify they load successfully.
