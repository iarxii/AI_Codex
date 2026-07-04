# Walkthrough — Colab Bridge & Llama.cpp Integration

We have successfully integrated the Colab Bridge custom provider across the entire AI Codex ecosystem and completed the transition from the Ollama App background service to the unified **OllamaOpt-Llama.cpp** (llama-server) model orchestration pipeline.

## Changes Made

### Backend

- **[config.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/config.py)**: Changed default `LOCAL_BACKEND_MODE` to `"llamacpp"`.
- **[models.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/models.py)**: Added `colab_bridge` to `_list_models_raw`, checking `/v1/models` (OpenAI format) and `/api/tags` (Ollama format), defaulting to `gemma-4-E4B_q4_0-it`.
- **[nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)**: Modified dynamic LLM instantiation to support `colab_bridge` with custom `base_url` (OpenAI format) or fallback to WebSocket `ChatBridge`.
- **[models.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/models.py)**: Added `colab_bridge` fallback mapping in the unified LLM factory.
- **[chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)**: Added missing `"api_keys": api_keys` mapping to backend chat endpoint configuration dictionary.

### Jupyter Notebook

- **[AICodex_Spirit_Bird.ipynb](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/notebooks/AICodex_Spirit_Bird.ipynb)**: Programmatically updated Ollama setup cells to download and start a background `llama-server` binary on port 8080 targeting the persistent Gemma 4 GGUF model (`/content/drive/MyDrive/open_models/Google/gemma-4-E4B_q4_0-it.gguf`). Injected the corresponding `LOCAL_BACKEND_MODE=llamacpp` and `LLAMACPP_BASE_URL` environment variables.

### VSCode Extension

- **[chatView.html](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/chatView.html)**: Registered Colab Bridge provider selection and key inputs. Handled visibility toggling, saving/loading state, and forwarding provider credentials.
- **[ChatViewProvider.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/ChatViewProvider.ts)**: Forwarded custom base URLs via standard `base_url` parameters and appended handshake secret keys (`providerKey`) into `X-API-Key` headers on model discovery.

### Web Client

- **[providerMeta.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/providerMeta.ts)**: Set the `brand` property to `'Colab'` and used inline rendering for the logo.
- **[ProviderIcon.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ProviderIcon.tsx)**: Automatically resolved nested brand icons (`Component.Color || Component`) to properly display the color Colab logo from `@lobehub/icons`.
- **[SettingsModal.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/SettingsModal.tsx)**: Added custom inputs for Colab Bridge URL and handshake secret key, including local testing functionality.
- **[ProviderSelector.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ProviderSelector.tsx)**: Updated to fetch from the backend models endpoint if a custom URL is configured, defaulting back to WebSocket sync.

## Verification & Build Results

- **Client Build**: Built the React project successfully using `npm run build` with zero errors:
  ```bash
  dist/index.html                     1.38 kB
  dist/assets/index-Cv2OklAe.css    130.83 kB
  dist/assets/index-kPPgJPFk.js   7,881.61 kB
  ✓ built in 13.18s
  ```
- **Extension Build**: Compiled the VSCode extension TypeScript workspace successfully with no errors:
  ```bash
  spirit-bird-codexspaces@1.1.7 compile
  tsc -p ./
  Exit code: 0
  ```
