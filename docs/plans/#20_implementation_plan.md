# Optimize Local LLM Inference for Llama.cpp Portal Parity

## Problem
Local Ollama/llama-server responds in **27s on Turn 1** and **times out (120s) on Turn 2**, while the native llama.cpp portal delivers blazingly fast responses. The root causes are:

1. **No Streaming**: `NativeLocalClient` used `stream: False`, forcing the UI to wait for the entire response before displaying anything.
2. **Template Mismatch**: Generic `SYSTEM: / USER:` tags don't match Llama-3's expected format, causing KV cache misalignment and full re-prefill on every turn.
3. **No Slot Reuse**: Missing `slot_id` parameter prevents llama-server from reusing existing KV cache slots across turns.
4. **LangGraph Bypass Needed**: `NativeLocalClient` is not a LangChain `BaseChatModel`, so LangGraph's `astream_events` cannot emit `on_chat_model_stream` events — tokens only arrive at `chain_end`.

## Proposed Changes

### Phase 1: Native Performance (✅ Complete)

#### [MODIFY] `backend/agent/local_client.py`
- ✅ Llama-3 instruction template (`<|start_header_id|>`, `<|eot_id|>`)
- ✅ `cache_prompt: True` + `slot_id: -1` for KV cache reuse
- ✅ Proper stop sequences matching the template tokens
- ✅ `astream()` method with SSE line parsing for real-time token delivery

#### [MODIFY] `backend/agent/nodes.py`
- ✅ Streaming path: when provider is `local` and `token_callback` is present, use `astream()` instead of `ainvoke()`
- ✅ Push each token chunk through the callback in real-time
- ✅ Terminal monitoring preserved (`print(token, end="", flush=True)`)

#### [MODIFY] `backend/api/chat.py`
- ✅ Inject `_token_callback` closure into graph config for local providers
- ✅ Callback updates `full_ai_response` and pushes tokens to WebSocket simultaneously
- ✅ Tokens arrive at the UI as they're generated, not after the full response

### Phase 2: Workspace Sentinel (Next)

#### [NEW] `backend/agent/workspace_sentinel.py`
- [ ] Create Sentinel node that maintains `data/workspace_status.md`
- [ ] Track key decisions and project goals across conversation turns
- [ ] Inject status file content into system prompt (within 200-char budget)

## Verification Plan

### Automated
- Check backend terminal for streaming output (tokens appearing one-by-one)
- Verify `llama-server` logs show "cache hit" on Turn 2
- Confirm TTFT (Time to First Token) < 2s on Turn 2

### Manual
- Verify UI displays tokens incrementally (not as a single block)
- Confirm Turn-2 latency is dramatically reduced vs. the 120s timeout
