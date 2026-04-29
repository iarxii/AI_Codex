# Implementation Plan - LLM Pipeline Stabilization (Refined)

This plan implements a high-efficiency, non-destructive refactor of the LLM inference pipeline. It eliminates synchronous blocking calls that cause GPU timeouts and correctly integrates the OllamaOpt context budgeting system.

## User Review Required

> [!IMPORTANT]
> **Native Inference for Local**: We will implement a lightweight, native caller for `llama-server` in the `local` node. This maintains the **LangGraph/RAG** architecture but bypasses the generic LangChain OpenAI wrapper to allow for better prompt caching and state management.
> **Context Budget Wiring**: The `LOCAL_BUDGET` will be reduced to ~1800 chars and **correctly wired** into the prompt construction, ensuring that local models are not overwhelmed by large system prompts or RAG snippets.

## Proposed Changes

### 1. Backend: Infrastructure & Auth Hardening
#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- **Async Pre-flight**: Convert synchronous `httpx.get` calls in `get_dynamic_llm` to `await` calls using an `AsyncClient`.
- **Cloud Auth Error**: Add a check for `ollama_cloud`: if `api_key` is empty, return a `ToolMessage` or `AIMessage` with a clear instruction: "Ollama Cloud API Key missing. Please open Settings to configure your credentials."
- **Timeout Extension**: Increase the `local` provider timeout to **120s** to handle high-load prefilling.

### 2. Backend: Context Builder Integration
#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- **Prompt Wiring**: Update `reason_node` to pass the `messages` through `context_builder.build_context()` before sending to the LLM. This ensures the `LOCAL_BUDGET` is actually applied.
- **Lazy Initialization**: Move `get_context_builder()` call inside the node logic so it only initializes when needed, avoiding unnecessary overhead on simple requests.

#### [MODIFY] [ollamaopt_bridge.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/integrations/ollamaopt_bridge.py)
- **Remove Blocking Probes**: Remove the synchronous `test_embedder.embed_text("test")` call from `get_retriever`. Replace with a lazy-detection mechanism or a static default for dimensions.

### 3. Backend: Native Local Caller
#### [NEW] [backend/agent/local_client.py]
- Implement a lean `NativeLocalClient` that talks directly to the `llama-server` `/completion` or `/v1/chat/completions` endpoint with `streaming=False` for maximum stability on local GPUs.

### 4. OllamaOpt: Budget Tuning
#### [MODIFY] [OllamaOpt/cli/context/model.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/OllamaOpt/cli/context/model.py)
- Refine `LOCAL_BUDGET` to prioritize **System Prompt** and **Recent History** over deep RAG context when operating in "Lean Mode".

## Verification Plan

### Automated Tests
- Run `scratch/test_ws.py` to confirm the `unauthorized` error is gone and `local` response times are improved.
- Verify that the backend no longer logs "blocking event loop" warnings during inference.

### Manual Verification
- Test `local` provider with a 95%+ GPU load; verify it eventually completes within the 120s window without timing out.
- Verify that the "Ollama Cloud API Key missing" message appears if the key is deleted from settings.
