# Implementation Plan - LLM Pipeline Stabilization

This plan addresses the performance gap between the `llama.cpp` portal and AICodex, fixes the "unauthorized" error for Cloud Ollama, and optimizes the local inference pipeline to prevent GPU timeouts.

## User Review Required

> [!IMPORTANT]
> **Context Budget Reduction**: I propose reducing the "Local" context budget from 3000 to 1500 characters. This will significantly speed up "prefilling" on your GPU but will reduce the amount of RAG data the AI can see at once.
> **Cloud Credentials**: You will need to provide an API key for the "Ollama (Remote Cloud)" provider via the settings UI (which I will update).

## Proposed Changes

### 1. Frontend: Provider & Key Management
#### [MODIFY] [ProviderSelector.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ProviderSelector.tsx)
- Add support for retrieving and sending the `ollama_cloud` API key from localStorage.
- Ensure the `X-API-Key` header is included for all cloud providers.

#### [MODIFY] [SettingsModal.tsx] (assuming this is where keys are entered)
- Add an input field for "Ollama Cloud API Key".

### 2. Backend: Local Pipeline Optimization
#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- **Prompt Caching Hint**: Add `cache_prompt: true` to the extra parameters for local models if supported by the provider.
- **Dynamic Timeout**: Increase the timeout for the first token but keep it strict for subsequent ones to handle high-load prefilling.
- **Context Striping**: Implement more aggressive history summarization for local providers to keep the prompt lean.

#### [MODIFY] [ollamaopt_bridge.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/integrations/ollamaopt_bridge.py)
- Update `get_context_builder` to support a "Lean Mode" for local providers.

#### [MODIFY] [OllamaOpt/cli/context/model.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/OllamaOpt/cli/context/model.py)
- Adjust `LOCAL_BUDGET` to a more aggressive 1500-2000 char limit to ensure fast TBT (Time to First Token) on mid-range GPUs.

### 3. Backend: Cloud Auth Fix
#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
- Ensure the `api_key` received from the frontend is correctly passed to the `ollama_cloud` provider initialization in the graph.

## Verification Plan

### Automated Tests
- Use `scratch/test_ws.py` to measure Time to First Token (TTFT) for local vs cloud.
- Verify that `unauthorized` errors are resolved by passing a dummy key.

### Manual Verification
- Compare response times between the `llama.cpp` portal and AICodex with the new "Lean Mode" enabled.
- Verify that the GPU usage is more stable during the "prefill" phase.
