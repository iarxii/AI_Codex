# AICodex: LLM Optimization & Memory Strategy

This document outlines the architectural decisions and technical optimizations implemented to ensure reliable, high-performance agentic reasoning across both local and cloud environments.

## 1. The Challenge: Local vs. Cloud Latency
Local inference (Ollama/llama.cpp) is constrained by GPU VRAM and "prefill" speed. Large context windows (8K+ tokens) cause significant delays (10s–30s) before a single word is generated. Cloud providers have larger windows but introduce cost and privacy trade-offs.

## 2. Lean Context Budgeting (1800 Characters)
To ensure near-instantaneous responses on local hardware, AICodex implements a strict **Lean Context Budget** for local providers.

- **Total Budget**: ~1800 characters (~450 tokens).
- **Distribution**:
    - **System Instructions**: 400 chars (Fixed "Identity").
    - **Workspace Meta**: 200 chars (Condensated state).
    - **History**: 600 chars (~3–5 recent turns).
    - **Current Query**: 600 chars (User input).
- **Optimization**: This budget allows for sub-1-second prefilling on most modern consumer GPUs (8GB+ VRAM).

## 3. Dual-Track Database Architecture
AICodex is designed to be "Technically Flexible," supporting two distinct storage paths based on the deployment environment:

### A. Local Development (PostgreSQL + pgvector)
- **Environment**: Docker-compose.
- **Search**: High-fidelity vector search using the `<=>` cosine distance operator.
- **Use Case**: Deep codebase RAG and complex semantic retrieval.

### B. Production / Cloud Run (SQLite + GCS)
- **Environment**: Serverless Google Cloud Run.
- **Persistence**: `aicodex.db` is synced to a Google Storage Bucket (GCS) to maintain state across stateless container restarts.
- **Search**: Optimized via **SQLite FTS5 (Full-Text Search)** for keyword-based history retrieval, bypassing the need for a managed vector database.

## 4. Persistent State Management (The "Sentinel" Pattern)
To overcome the sliding-window memory loss of the 1800-character budget, AICodex uses a **Sentinel Agent** to maintain "Long-Term Working Memory."

- **The Meta-File**: A persistent `data/workspace_status.md` file.
- **The Logic**: 
    - Every few turns, a background process (or Cloud LLM "Crutch") summarizes the conversation.
    - Key facts, decisions (e.g., *"Database port set to 9000"*), and current objectives are saved to the meta-file.
- **The Injection**: The contents of this file are injected into the System Prompt of every request, giving the Local LLM "God Mode" awareness of the project state at a negligible token cost.

## 5. Native Inference Optimization

### A. Llama-3 Instruction Templating
- **Problem**: Generic `SYSTEM: / USER:` tags cause KV cache misalignment. The server re-processes the entire prompt from scratch on every turn.
- **Solution**: `NativeLocalClient` now uses Llama-3 native header IDs (`<|start_header_id|>`, `<|eot_id|>`), ensuring the prompt format matches what the model was trained on. This enables:
    - **Proper KV Cache Reuse**: The system prompt prefix is cached on Turn 1 and reused on Turn 2+.
    - **Correct EOS Detection**: The model stops at `<|eot_id|>` instead of generating runaway tokens.

### B. Native SSE Streaming
- **Problem**: Without streaming, the UI waits 27–120s before showing any response.
- **Solution**: `NativeLocalClient.astream()` parses SSE events from `llama-server` and pushes tokens to the WebSocket via a callback closure injected into the LangGraph config.
- **Result**: Tokens appear in the UI within ~1–2s of the request (Time to First Token), matching the native llama.cpp portal experience.

### C. Slot & Cache Management
- `cache_prompt: True` — Tells llama-server to cache the processed prompt tokens.
- `slot_id: -1` — Lets the server pick the optimal slot for cache reuse.
- **Effect**: Turn-2+ prefill drops from 27s to near-zero for unchanged prompt prefixes.

### D. Async Pre-flights
- All connection checks and embedding probes are asynchronous, preventing the backend event loop from blocking during the pre-inference phase.
- Extended **120s timeout** for local inference to accommodate cold-starts or heavy KV cache prefilling.

## 6. Implementation References
- **Context Logic**: `backend/integrations/ollamaopt_bridge.py`
- **Budget Constants**: `OllamaOpt/cli/context/model.py`
- **Inference Nodes**: `backend/agent/nodes.py`
- **Native Client**: `backend/agent/local_client.py`
- **WebSocket Handler**: `backend/api/chat.py`
