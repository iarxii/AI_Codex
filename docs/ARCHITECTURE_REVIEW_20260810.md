# AI_Codex — System Architecture Review

**Date:** 2026-08-10  
**Scope:** Full project audit — backend, VS Code extension, MCP, MT5, deployment  
**Status:** Tool execution pipeline partially broken (see Section 6)

---

## 1. System Overview

AI_Codex is a multi-agent AI platform for code generation, education, and algorithmic trading. It consists of a Python FastAPI backend (agentic engine), a TypeScript VS Code extension (in-editor harness), a TypeScript MCP server (local tools), a Dockerized MetaTrader 5 container (gRPC trading bridge), and a React web frontend.

The core interaction model: a client (web or VS Code) connects to the backend via WebSocket. The backend runs a LangGraph agent that streams tokens, calls tools, and manages conversation state. The agent is powered by a tiered LLM provider chain with automatic fallback.

```
┌─────────────────┐     WebSocket      ┌──────────────────────────────────┐
│  VS Code        │ ◄────────────────► │  FastAPI Backend (Cloud Run)     │
│  Extension      │   /ws/agent        │                                  │
│  (TypeScript)   │                    │  ┌────────┐  ┌──────────────┐   │
└─────────────────┘                    │  │ LangGraph│  │ LLM Provider │   │
                                       │  │ Agent   │  │ Router       │   │
┌─────────────────┐     HTTPS/WS      │  │         │  │              │   │
│  React Web      │ ◄────────────────► │  │ init →  │  │ Workers AI   │   │
│  Frontend       │                    │  │ planner │  │ Ollama Cloud │   │
│  (Vite/Netlify) │                    │  │ reason  │  │ OpenRouter   │   │
└─────────────────┘                    │  │ execute │  │ Groq         │   │
                                       │  │ guard   │  │ Gemini       │   │
┌─────────────────┐     stdio/WS      │  │ validate│  │ Local Ollama │   │
│  MCP Server     │ ◄────────────────► │  │ evaluate│  │              │   │
│  (TypeScript)   │                    │  └────────┘  └──────────────┘   │
└─────────────────┘                    │                                  │
                                       │  ┌────────┐  ┌──────────────┐   │
┌─────────────────┐     gRPC/JSON-RPC │  │ SQLite  │  │ MT5 Bridge   │   │
│  MT5 Container  │ ◄────────────────► │  │ (WAL)   │  │ (Docker)     │   │
│  (Docker/Wine)  │                    │  └────────┘  └──────────────┘   │
└─────────────────┘                    └──────────────────────────────────┘
```

---

## 2. Backend (`backend/`)

### 2.1 Entry Point — `backend/main.py`

FastAPI app with async `lifespan` context manager:
- Starts Go sidecar (`ms_agent`) on port 50051 if binary present
- Syncs SQLite from Google Cloud Storage (Cloud Run only)
- Initializes DB schema, seeds Codex Spaces, elevates `nexus-architect` super-admin
- Initializes OllamaOpt bridge (RAG/context builder)
- Mounts static files for knowledge graphs
- Registers 16 API routers
- WebSocket endpoint at `/ws/debug` (echo)

### 2.2 Agent System (`backend/agent/`)

Built on **LangGraph** — stateful, cyclic graph.

**Graph Nodes (`graph.py`):**

| Node | Purpose |
|------|---------|
| `init` | Metadata handshake, latency benchmarks, prompt classification (short vs long) |
| `planner` | Creates structured task plan (JSON checklist) for complex requests |
| `guard` | Pre-reasoning validation: stuck-loop detection, context budget check |
| `reason` | Main LLM invocation node |
| `execute_tool` | Runs tool calls |
| `validate` | Response validation, fabrication detection |
| `verification` | Post-execution verification |
| `evaluate_turn` | Quality scoring, stagnation detection |
| `final_report` | Generates final response with optional Tutor block |
| `handle_blocker` | Error recovery, loop breaking |
| `trading_debate` | Bull/Bear debate (Trading Space only) |
| `mql5_enforcer` | Risk gate for trade execution (Trading Space only) |

**Routing Logic:**
- `init` → `reason` (short process) | `trading_debate` (trading) | `planner` (default)
- `reason` → `execute_tool` | `mql5_enforcer` | `validate` | `END`
- `evaluate_turn` → `final_report` | `handle_blocker` | `guard` (retry)
- Stagnation: 4 identical tool calls → blocker
- Quality degradation: 3 declining scores → blocker

**State (`state.py`):** `AgentState` TypedDict with messages, tool calls, telemetry, routing decision, scratchpad, evaluation report, quality history.

### 2.3 LLM Provider Routing (`nodes.py`)

**Supported Providers:**

| Provider | Library | Models |
|----------|---------|--------|
| `local` (Ollama) | `langchain_openai` → Ollama `/v1` | llama3.2:3b, codellama |
| `local` (llamacpp) | `NativeLocalClient` (custom) | Manual chat templates |
| `groq` | `langchain_groq` | llama-3.3-70b-versatile, llama-3.1-8b-instant |
| `openrouter` | `langchain_openai` | claude-sonnet-4, llama-3-8b |
| `gemini` | `langchain_google_genai` | gemini-1.5-pro/flash |
| `ollama_cloud` | `langchain_openai` | llama3 |
| `colab_bridge` | `ChatBridge` / `ChatOpenAI` | gemma-4-E4B |
| `cloudflare_ai_gateway` | `langchain_openai` | @cf/meta/llama-3-8b |
| `workers_ai` | `langchain_openai` | @cf/meta/llama-3-8b |

**Tiered model routing:** Different models for routing/guard/validation (fast, cheap) vs reasoning/coder (powerful).

**Fallback chain:** `ollama_cloud` → `openrouter` → `groq` → `gemini` → `local`

**Tool binding:** Conditional — skipped for `NativeLocalClient` (no OpenAI function calling), skipped if model lacks "Tools" capability.

### 2.4 WebSocket Pipeline (`api/chat.py`)

The `/ws/agent` WebSocket is the core real-time pipeline:

1. JWT auth (query param) + optional premium handshake
2. Space access control
3. History loading (DB or client payload)
4. Graph execution via `agent_graph.astream_events()` (LangGraph v2 streaming)
5. Token streaming — `token_delta` events at 75ms flush intervals
6. Tool call/result streaming — `tool_call`, `tool_result` events
7. Telemetry — TTFT, latencies, token counts, node sequence
8. LangSmith tracing (optional, scrubbed)
9. Heartbeat monitor — status every 5s if node >15s
10. Rate limiting — 1.5s cooldown per user
11. Cancel/ping/status — client interaction messages

### 2.5 Database Layer

**ORM:** SQLAlchemy async (aiosqlite or asyncpg)

**Tables:**

| Table | Purpose |
|-------|---------|
| `users` | Auth, profile, role, settings_json |
| `conversations` | Chat sessions, space_type |
| `messages` | Chat messages (user/assistant/tool/system) |
| `skills` | Skill registry |
| `document_chunks` | RAG embeddings (pgvector, 384-dim) |
| `codex_spaces` | Space catalog |
| `codex_space_access` | Space access control |
| `bridge_sessions` | Colab bridge sessions |
| `invoice_clients` / `invoices` / `invoice_items` / `invoice_payments` | Business invoicing (ZAR) |
| `arcade_scores` | Game high scores |
| `cached_streams` | Cached streaming data |

**SQLite pragmas:** WAL mode, temp_store=MEMORY, synchronous=NORMAL

### 2.6 Authentication (`api/auth.py`)

- JWT with `python-jose` (HS256, 1-week expiry)
- OAuth2 password bearer flow
- Password hashing with `passlib` (pbkdf2_sha256)
- GOD_MODE_ON backdoor for nexus-architect
- Premium handshake middleware — `X-Codex-Premium-Key` header

### 2.7 Integrations (`backend/integrations/`)

| Integration | Purpose |
|-------------|---------|
| `ollamaopt_bridge.py` | Imports sibling OllamaOpt project for RAG (Qdrant→Postgres swap), ContextBuilder, ModelRouter |
| `postgres_store.py` | pgvector-backed vector store (replaces Qdrant) |
| `mt5_server.py` | TCP socket client to MT5 bridge (JSON-RPC) |
| `market_pipeline.py` | Background polling loop (1s) for market ticks |

### 2.8 Configuration (`config.py`)

Pydantic Settings from `.env`:
- `SECRET_KEY`, `ALGORITHM`, token expiry
- `OLLAMA_BASE_URL`, `LLAMACPP_BASE_URL`, `LOCAL_BACKEND_MODE`
- `DB_TYPE` (sqlite/postgres), `DATABASE_URL`
- `GCS_BUCKET_NAME` — Cloud Run SQLite persistence
- `COLAB_SECRET` — premium handshake key
- `ALLOWED_COMMANDS` — sandbox command whitelist
- `CORS_ORIGINS`

---

## 3. VS Code Extension (`vscode-extension/`)

### 3.1 Architecture

TypeScript extension providing in-editor AI agent harness.

**Key components:**

| Component | File | Purpose |
|-----------|------|---------|
| Entry point | `src/extension.ts` | Activation, command registration, panel registration |
| Chat panel | `src/panels/ChatViewProvider.ts` | Main webview — WebSocket client, tool dispatch, UI state |
| Context panel | `src/views/ContextWindowPanelProvider.ts` | Agent telemetry/scratchpad viewer |
| Solution Explorer | `src/views/SolutionExplorerProvider.ts` | TreeView for workspace file CRUD |
| Custom Browser | `src/panels/CustomBrowserPanel.ts` | In-extension web browser |
| HTTP client | `src/api/client.ts` | REST API for codegen, history, models |
| WS client | `src/api/WebSocketClient.ts` | WebSocket lifecycle, reconnect, heartbeat |
| MCP manager | `src/utils/McpManager.ts` | MCP server lifecycle (stdio JSON-RPC) |
| Local retriever | `src/utils/LocalRetriever.ts` | On-device semantic search (`@huggingface/transformers`) |
| Provider config | `src/config/providerSettings.ts` | Session state, credential namespacing, migration |
| Provider metadata | `src/config/providerMetadata.ts` | 21 LLM provider definitions |
| Agent tools | `src/config/agentTools.ts` | Client capability tool catalog |

### 3.2 Client-Side Tool Execution

**How tools reach the client:**

1. Extension sends `scratchpad.mcp_tools` on every chat request (line 2357)
2. Tools include `AGENT_CAPABILITY_TOOLS` (pi_codex_launch, browser_open) + discovered MCP tools
3. Backend LLM binds these tools; when it calls one, backend emits `client_tool_call`
4. Extension receives event in `handleWsEvent` → dispatches to `handleClientToolCall`
5. Extension executes tool locally, sends `tool_response` back via WebSocket

**`handleClientToolCall` dispatch table:**

| Tool name | Handler method |
|-----------|---------------|
| `workspace_writer` | `executeFileWrite()` |
| `workspace_patcher` | `executeFilePatch()` |
| `workspace_reader` | `executeFileRead()` / `executeFileList()` |
| `shell_exec` | `executeCommand()` |
| `preflight_check` | `executePreflightCheck()` |
| `pi_codex_launch` | `executePiCodexLaunch()` → `handleLaunchPiCli()` |
| `browser_open` | `executeBrowserOpen()` → `CustomBrowserPanel.createOrShow()` |
| *(fallback)* | `mcpManager.callTool()` |

### 3.3 Known Issue — `_isGenerating` Gate (FIXED)

**Location:** `src/panels/ChatViewProvider.ts:2590`

**Problem:** The line `if (!this._view || !this._isGenerating) return;` sat before the `client_tool_call` dispatch. After the backend emitted `done` (setting `_isGenerating = false`), any subsequent `client_tool_call` was silently dropped.

**Fix applied (2026-08-10):** Added an early-return exemption for `client_tool_call` before the gate, mirroring the existing `auth_required` pattern:

```typescript
if (event.type === "client_tool_call") {
  this.handleClientToolCall(event);
  return;
}
```

---

## 4. MCP Server (`mcp/`)

TypeScript MCP server providing local tools via stdio transport.

- **Tools:** `create-user`, `get-user-by-id` (SQLite-backed)
- **Sub-servers:** `git-mcp`, `sql-mcp`, `py-mcp`, `db`
- **SDK:** `@modelcontextprotocol/sdk` v1.17.5
- **Database:** `sqlite3` with JSON user data

---

## 5. MT5 Container (`mt5_container/`)

Dockerized MetaTrader 5 terminal for algorithmic trading.

- **Dockerfile** — Wine + MT5 installation
- **gRPC bridge** (`bridge.py`) on port 50051:
  - `GetHistoricalTicks` — streaming tick data
  - `ExecuteOrder` — BUY/SL with risk checks
  - `GetAccountInfo` — balance, equity, broker
- **Protobuf** schema (`bridge.proto`)
- **Supervisor** process management
- **VNC** on port 5900 for debugging
- **Backend connects** via `MT5Client` TCP socket (port 8090)

---

## 6. Tool Execution — Current Status & Blockers

### 6.1 What was broken (and fixed)

The `_isGenerating` gate in `ChatViewProvider.ts` prevented `client_tool_call` events from being processed after a generation turn ended. This is now fixed.

### 6.2 What is still broken

**The backend has no working LLM provider.** The entire agent loop depends on at least one functional LLM. The fallback chain is:

```
ollama_cloud → openrouter → groq → gemini → local
```

| Provider | Status | Root cause |
|----------|--------|-----------|
| Workers AI | Rate-limited / 401 | No `CLOUDFLARE_ACCOUNT_ID`; placeholder API key |
| Ollama Cloud | Model not found | Points to `localhost:11434` instead of real cloud URL |
| OpenRouter | No key | No API key in `.env` or extension SecretStorage |
| Groq | No key | No API key in `.env` or extension SecretStorage |
| Gemini | No key | No API key in `.env` or extension SecretStorage |
| Local Ollama | Not running | Ollama app not started on localhost:11434 |

**Result:** The backend cannot initialize any LLM. The LangGraph agent never starts. No `client_tool_call` events are ever emitted. The extension's tool dispatch code is never reached.

### 6.3 What is needed to restore function

At least one provider must be operational:

**Option A — Local Ollama:**
```powershell
ollama pull llama3.2:3b
# Keep Ollama running on localhost:11434
```
Then select "Local LLM" in the extension Settings → Providers.

**Option B — Cloud provider API key:**
Enter a valid API key for Gemini, Groq, OpenRouter, etc. in the extension Settings → Providers panel.

**Option C — Fix Ollama Cloud:**
Set `OLLAMA_CLOUD_BASE_URL` in `backend/.env` to a real remote Ollama endpoint.

---

## 7. Deployment Architecture

### 7.1 Cloud Run (Backend)

- **Entry:** `backend/main.py` via uvicorn
- **Database:** SQLite with GCS sync (`aicodex-data-1096425756328`)
- **Persistence:** WAL-mode SQLite uploaded/downloaded from GCS on each request
- **Scaling:** Stateless — all state in SQLite + GCS
- **Environment:** `K_SERVICE` env var detected for Cloud Run mode

### 7.2 Netlify (Frontend)

- React + TypeScript SPA at `adaptivconceptfl.netlify.app`
- Vite build, Tailwind styling

### 7.3 Docker Compose (Local)

| File | Services |
|------|----------|
| `docker-compose.yml` (root) | `db` — pgvector/pg16 on port 5432 |
| `mt5_container/docker-compose.yml` | `mt5-node` — gRPC bridge (50051) + VNC (5900) |

### 7.4 VS Code Extension Distribution

- Packaged as `.vsix` (`spirit-bird-codexspaces-1.3.13.vsix`)
- Bundled Pi CLI tarball (`vendor/pi-coding-agent.tgz`) for offline install
- Published to VS Code Marketplace under `spirit-bird-aicodex`

---

## 8. Data Flow — Complete Request Lifecycle

```
1. User types message in VS Code chat panel
2. Extension builds payload:
   - conversation_id, message, raw_prompt
   - context (workspace, attachments)
   - provider, model, api_keys, base_url
   - messages (history)
   - scratchpad (retrieved_chunks, mcp_tools)
3. Extension sends via WebSocket to /ws/agent
4. Backend authenticates JWT, loads conversation
5. Backend classifies prompt (short vs long process)
6. Backend enters LangGraph loop:
   a. guard → check context budget, stuck loops
   b. reason → invoke LLM (with fallback chain)
   c. If LLM calls tool:
      - Backend tool → execute_tool node → result → reason
      - Client tool → emit client_tool_call → wait for tool_response
   d. validate → check response quality
   e. evaluate_turn → score, detect stagnation
   f. Loop or finalize
7. Backend streams events to extension:
   - token_delta (streamed text)
   - tool_call / tool_result (backend tools)
   - client_tool_call (client tools)
   - telemetry (TTFT, tokens, latencies)
   - done (generation complete)
8. Extension renders tokens in webview
9. Extension handles client_tool_call:
   - Execute locally (file write, shell, browser, etc.)
   - Send tool_response back
10. Backend receives tool_response, continues loop
```

---

## 9. Key Design Decisions & Trade-offs

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| SQLite on Cloud Run | Simple, no managed DB cost | GCS sync latency; not truly horizontal |
| LangGraph cyclic graph | Multi-step reasoning, self-correction | Complexity; harder to debug than linear chains |
| Client-side tool delegation | VS Code APIs inaccessible from backend | Requires working WebSocket + LLM to drive it |
| Tiered LLM routing | Cost optimization (cheap models for routing) | Multiple provider configs to maintain |
| Fallback chain | Resilience when providers fail | Each failure adds latency before fallback |
| 21 LLM providers | Maximum flexibility | Configuration burden; most will never be used |
| On-device semantic retrieval | Privacy, offline context | Model download size; indexing latency |
| Pi CLI bundling | Offline CLI deployment | Large VSIX package |

---

## 10. Risks & Technical Debt

1. **Single point of failure: LLM providers.** No provider redundancy without API key management. All cloud providers require paid keys.

2. **SQLite on Cloud Run.** GCS sync is fragile — concurrent writes can corrupt. No real migration system (manual `ALTER TABLE` in `migrate_db()`).

3. **No provider health check at startup.** The backend doesn't verify that at least one LLM is reachable before accepting WebSocket connections.

4. **Tool binding is conditional.** If the selected model doesn't advertise "Tools" capability, the agent runs without tools silently.

5. **Extension `_isGenerating` state is fragile.** Multiple code paths set it to `false` (done, error, cancel), each potentially dropping in-flight client tool calls. The `client_tool_call` exemption fixes the immediate issue, but `user_input_request` and `scratchpad_update` may have the same class of bug.

6. **Prompt assembly is file-based.** System prompts are loaded from `data/profile/*.md` files at runtime. No versioning or validation of prompt structure.

7. **No integration tests for the full pipeline.** Unit tests cover config/settings, but not the WebSocket → agent → tool → response flow.

---

## 11. Recommendations

1. **Immediate:** Configure at least one working LLM provider (local Ollama or cloud API key).
2. **Short-term:** Add a backend health endpoint that verifies LLM provider availability at startup.
3. **Short-term:** Audit all WebSocket event types for the same `_isGenerating` gate issue (`user_input_request`, `scratchpad_update`).
4. **Medium-term:** Add integration tests for the WebSocket → agent → tool execution flow.
5. **Medium-term:** Consider a lightweight local agent mode that doesn't require cloud LLM for simple tasks.
6. **Long-term:** Migrate from SQLite+GCS to Postgres for reliable multi-instance deployment.

---

*Report generated: 2026-08-10*  
*Codebase version: vscode-extension v1.3.13*
