# AICodex Debugging & Stabilization Log (v1.0)

This document tracks critical technical resolutions and architectural decisions made during the stabilization of the AICodex Agentic Portal.

## 1. Real-time Communication (WebSocket)

### 🔴 Issue: UI Freezes & Silence during Reasoning
*   **Symptom**: The agent would start "Thinking" but the chat would remain empty for 30-60 seconds until the full response arrived.
*   **Resolution**: Migrated the backend streaming logic to `astream_events` (v2).
*   **Implementation**: 
    *   Switched from `astream` to `astream_events` to capture granular token chunks and node lifecycle events.
    *   Enabled `streaming=True` in `ChatOllama` configuration.
    *   Implemented a cumulative `full_ai_response` buffer in `chat.py` to ensure smooth UI updates.

## 2. Ollama API Compatibility (RAG)

### 🔴 Issue: 404 Not Found on `/api/embeddings`
*   **Symptom**: `Ollama HTTP error: 404 Client Error: Not Found`.
*   **Cause**: Recent Ollama versions (v0.1.34+) deprecated `/api/embeddings` in favor of `/api/embed`. The integrated `OllamaOpt` library was hardcoded to the legacy endpoint.
*   **Resolution**: Implemented a **Monkey-Patch** in the bridge layer.
*   **Logic**: 
    ```python
    def patched_embed_text(self, text: str):
        res = original_embed_text(self, text) # Try legacy
        if res is not None: return res
        
        # Fallback to modern endpoint
        modern_endpoint = f"{self.api_base}/api/embed"
        payload = {"model": self.model, "input": text}
        # ... logic to handle /api/embed response format ...
    ```

### 🔴 Issue: Embedding Model Latency/Availability
*   **Resolution**: Transitioned default embedding model from `nomic-embed-text` to `all-minilm`.
*   **Rationale**: `all-minilm` uses 384 dimensions (vs 768), resulting in faster vector calculations and smaller database footprints, while maintaining high accuracy for coding tasks.

## 3. Agent Workflow Stability

### 🔴 Issue: `missing 1 required positional argument: 'memory_items'`
*   **Symptom**: `Context building failed` during the reasoning turn.
*   **Cause**: Signature mismatch between `AI_Codex` and the latest `OllamaOpt` `ContextBuilder.build()` method.
*   **Resolution**: Updated `reason_node` in `nodes.py` to pass the `memory_items` list (even if empty) to satisfy the positional argument requirement.

### 🔴 Issue: Multi-turn Tool Loop Reset
*   **Symptom**: Agent would lose context after a tool call, repeating the same query.
*   **Cause**: `reason_node` was incorrectly rebuilding the message history without accounting for existing `AIMessage` chunks with tool calls.
*   **Resolution**: Hardened the history assembly logic to preserve the full chain: `[HumanMessage, AIMessage(tool_calls), ToolMessage(result)]`.

## 4. UI/UX Enhancements

### ✅ Collapsible Thinking Process
*   **Feature**: Integrated a collapsible `<details>` block directly into the chat stream.
*   **Benefit**: Provides high-fidelity visibility into the agent's graph transitions (`REASON` -> `EXECUTE_TOOL`) without cluttering the final response.

### ✅ Context Inspector (RAG Grounding)
*   **Feature**: Real-time updates for tool execution status and grounding sources.
*   **Benefit**: Users can verify exactly what documents or tools were used to generate a response.

---
**Last Updated**: 2026-04-24
**Status**: Stable / Interactive
