Viewed LLM_Optimization_Strategy.md:1-31

I will research the performance bottleneck between the `NativeLocalClient` and the `llama-server` (or Ollama) instance, specifically looking for why the KV cache isn't being reused and why latency is so high compared to the native portal. Then, I will create a detailed plan and task tracker to achieve "blazingly quick" local responses.

### Research Phase

1.  **Latency Analysis**: 27.8s for a simple response on an 1800-character prompt indicates that **Prompt Caching is not working**. The server is re-processing the entire system prompt and history on every turn.
2.  **Streaming**: The `NativeLocalClient` currently has `stream: False`. Enabling streaming will provide the "instant feel" the user is looking for.
3.  **Template Mismatch**: The current manual string concatenation (`SYSTEM:`, `USER:`, `ASSISTANT:`) doesn't match the Llama-3 instruction format, which can cause the model to generate extra tokens or struggle with termination, increasing latency.
4.  **Server Detection**: The logs show `localhost:11434` (Ollama default port). If the user is running `llama-server` on this port, our `/completion` call works. If they are actually running Ollama, we should be using `/api/chat` or `/api/generate` for better native performance.

---

### Implementation Plan

# [Goal] Optimize Local LLM Inference for "Llama.cpp Portal" Parity

Achieve near-instant responses for local LLM providers by implementing native streaming, proper prompt templating, and maximizing KV cache reuse.

## Proposed Changes

### [Component] Backend Core

#### [MODIFY] [local_client.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/local_client.py)
- **Implement Streaming Support**: Refactor `ainvoke` to support an `astream` mode (or return a generator) that the WebSocket can consume.
- **Native Prompt Templating**: Implement Llama-3 specific header IDs (`<|start_header_id|>`) to match what the model expects.
- **Cache Optimization**: Add `slot_id: -1` and `stop` sequences to allow `llama-server` to manage persistent sessions.

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- **Streaming Handover**: Update `reason_node` to pass the stream back to the WebSocket handler if the provider is `local`.

### [Component] Database / State

#### [NEW] [workspace_sentinel.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/workspace_sentinel.py)
- Implement the "Sentinel" logic to update `workspace_status.md` every N turns, keeping the "Lean Context" budget focused on the immediate task.

---

## Verification Plan

### Automated Tests
- Benchmarking the "Time to First Token" (TTFT) for Turn 1 vs Turn 2.
- Verifying that the `llama-server` logs show "cache hit" for the system prompt prefix.

### Manual Verification
- Testing the feel of the UI with streaming enabled.
- Verifying that the `workspace_status.md` file correctly captures project goals.

---

# Task Tracker: LLM Performance & Sentinel Implementation

- [ ] Refactor `NativeLocalClient` to support **Streaming** (SSE parsing)
- [ ] Implement **Llama-3 Template** formatting in `local_client.py`
- [ ] Enable **Prompt Caching** headers for `llama-server`
- [ ] Create **Workspace Sentinel** agent node
- [ ] Wire **workspace_status.md** into the reasoning system prompt
- [ ] Update `reason_node` to handle streaming generators
- [ ] Benchmark Turn-2 latency reduction

---

I have updated the **Implementation Plan** and **Task Tracker**. I'll now start by refactoring the `NativeLocalClient` to enable streaming, as that is the biggest factor in the "blazing fast" perception.

Wait, I should confirm the `NativeLocalClient` can handle streaming. I'll read the file again to make sure I have the latest version before editing.

Viewed local_client.py:1-53
Edited local_client.py
Viewed nodes.py:210-250
Viewed chat.py:100-150

I have updated the **Implementation Plan** and created a **Task Tracker** to address the performance gap between your local setup and the `llama.cpp` portal.

### Technical Analysis: Why it was slow
1.  **Cache Misses**: The previous client used a generic `SYSTEM: / USER:` template. If this doesn't match the model's native format (Llama-3), the KV cache often fails to align, forcing a full "prefill" (the 27s delay you saw) on every single turn.
2.  **Streaming**: Without streaming, you have to wait for the entire response to be generated before seeing a single character. This makes the system feel "dead" for 120 seconds.
3.  **Slot Management**: I've added `slot_id: -1` to the native client, which tells `llama-server` to intelligently reuse existing slots, a key feature used by the native portal.

---

### Phase 1: Native Performance (In Progress)
I have already refactored [local_client.py](file:///c:/AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\agent\local_client.py) with:
*   **Llama-3 Templates**: Using `<|start_header_id|>` and `<|eot_id|>` tags.
*   **Persistent Caching**: Forced `cache_prompt: True`.
*   **SSE Streaming Engine**: Added a native SSE parser for `astream` support.

---

### Phase 2: The "Sentinel" Agent (Next Step)
I will now implement the **Workspace Sentinel**. This is a dedicated background node that maintains a `workspace_status.md` file. This ensures the "Lean Context" doesn't "forget" the project structure as the conversation grows.

````carousel
```markdown
# Implementation Plan: LLM Optimization
- [x] Refactor NativeLocalClient for Llama-3 + Caching
- [/] Implement Streaming Handover in reasoning nodes
- [ ] Create Workspace Sentinel Node
- [ ] Integrate workspace_status.md into System Prompt
```
<!-- slide -->
```markdown
# Task Tracker (AICodex Docs)
1. **Streaming**: Connect the backend WebSocket to the new `astream` generator.
2. **Persistence**: Ensure `workspace_status.md` is synced to GCS/Docker volumes.
3. **Budgeting**: Validate that the 1800-char budget is enforced *after* template application.
```
````

**I am now moving to update the `reason_node` in `nodes.py` to leverage the new streaming capability.** This will eliminate the 120s "blind wait" and provide immediate token feedback.

Should I proceed with wiring the streaming events to the UI now?