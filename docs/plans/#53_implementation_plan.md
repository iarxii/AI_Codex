# Client Routing & Tool Logic Separation — Revised Plan

This document is the codebase-verified deep analysis and implementation plan for separating tool-use, heuristics, and routing logic across the `AI_Codex` client portals. All findings are cross-referenced against live source files and updated with user feedback from the review.

---

## Background & Observation

Recent enhancements to the `VSCodex` extension's tool calling (tracked in [#7_walkthrough.md](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/docs/%237_walkthrough.md)) introduced `client_type`-based delegation in `execute_tool_node`. However, the changes were scoped **only** to the tool execution path — the tool **binding**, **heuristic classification**, and **graph routing** layers remain client-agnostic. This creates a bleed effect where:

1. The Web app binds IDE-specific tools the LLM can attempt to call but no client can execute.
2. The `is_short_process` heuristic uses IDE-centric keyword lists, misclassifying web conversational queries.
3. The graph routing treats all clients identically regardless of their execution capabilities.

> [!IMPORTANT]
> **Clarification from user:** Prior to the VSCodex tool-call enhancements, the Web app's tool calling was **largely functioning as intended** by utilizing the **Agent Canvas** ([AgentCanvas.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx)) for artifact rendering (Code, Docs, Research tabs + ZIP export). The orchestration isn't completely broken — the agent still replies on the web — the problem is specifically when it has to make tool calls that are now biased toward the VSCodex extension's local filesystem delegation model.

---

## Client Capability Matrix (User-Confirmed)

| Client | Classification | Filesystem Access | Tool Delegation Model | UI Rendering |
|---|---|---|---|---|
| **VSCodex** | IDE Extension | Local workspace via extension host | Delegates `workspace_*` and `shell_exec` back to client via WebSocket | Webview HTML (`chatView.html`) |
| **Web.AICodex** | Web Application | Server-side only (future: Cloud Run Sandbox + WebContainers for premium) | Tools execute server-side; artifacts rendered in Agent Canvas | React SPA (`Chat.tsx` + `AgentCanvas.tsx`) |
| **AIDock** | Docker-served Web Interface | **Mounted Docker volumes** — can do filesystem CRUD + terminal exec | Tool calls should closely resemble VSCodex: delegate to mounted-filesystem CRUD and terminal command execution via FastAPI (or similar) | Docker-hosted web frontend |
| **AI_Droid** | Android App (future) | Device-local (TBD) | Minimal/API-driven tools | Native Android UI (forked from [AI_Droid](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Droid)) |

> [!NOTE]
> **AIDock** is **not** a simple Web variant. Its tool set must closely match VSCodex because it has a real mounted filesystem inside the Docker container. The key difference is the delegation transport: VSCodex delegates via VS Code's `postMessage` bridge → extension host; AIDock will need to delegate via its own FastAPI backend (or equivalent) that has direct access to the container's filesystem and shell.

---

## Findings

### Finding 1 — Web Frontend Never Sends `client_type`

> [!CAUTION]
> **Severity: P0 — The entire client-routing strategy has no Web-side identifier.**

The `VSCodex` extension sends `client_type: 'vscode'` in its WebSocket payload ([ChatViewProvider.ts:1670](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/ChatViewProvider.ts#L1670)). However, the **Web frontend** (`Chat.tsx`) never includes `client_type` in its payload:

```typescript
// Chat.tsx lines 617-632 — NO client_type field
const payload = {
    message: input,
    conversation_id: currentConvId,
    provider: activeProvider,
    model: activeModel,
    api_key: apiKey,
    // ... no client_type
};
```

**Impact:** On the backend, `payload_data.get("client_type")` resolves to `None` for every Web request. The `execute_tool_node` check at [nodes.py:877](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L877) (`client_type == "vscode"`) correctly skips delegation, but the **absence of a positive identifier** means the backend cannot distinguish "Web client" from "unknown client" from "future AIDock/Android client".

**Required Fix:**
- Web frontend (`Chat.tsx`): Add `client_type: 'web'` to both `handleSend` and `handleRetry` payloads.
- Backend (`chat.py`): Default `client_type` to `"web"` when not provided, for backwards compatibility.

---

### Finding 2 — `is_short_process` Heuristic Is Client-Blind

> **Severity: P1 — Misclassification of Web queries.**

The `init_node` heuristic at [nodes.py:286-322](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L286-L322) applies the same logic to all clients.

**User clarification:** The `is_short_process` fast-path **should be retained** for Web clients — it works correctly for actual greetings and acknowledgments. The issue is only with the 45-char length threshold + IDE-centric action-word list misclassifying substantive short Web queries.

| Query | Client | Current Result | Expected Result |
|---|---|---|---|
| `"What is a neural network?"` | Web | `is_short_process = True` (38 chars, no action words) | `False` — should reason |
| `"Explain this code"` | Web | `is_short_process = True` (17 chars, no action words) | `False` — should reason |
| `"Hi"` | Web | `is_short_process = True` | `True` ✓ |
| `"Hi"` | VSCodex | `is_short_process = True` | `True` ✓ |
| `"Create a test.py"` | VSCodex | `is_short_process = False` | `False` ✓ |

**Required Fix:** Keep `is_short_process` for all clients, but tune the heuristic per `client_type`:
- **`vscode` / `aidock`**: Keep the current strict heuristic (optimized for IDE interactions where most queries are technical).
- **`web`**: Only short-circuit on **explicit** greetings and acknowledgments (the named set). Remove or significantly raise the length-based fallback threshold since Web users commonly ask short substantive questions.
- **`android`/`mobile`**: Similar to Web — voice-input patterns are shorter but substantive.

---

### Finding 3 — Tool Registry Binds All Tools Universally

> **Severity: P1 — Web/mobile clients receive tools they cannot execute.**

[tools.py:41-104](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/tools.py#L41-L104) returns **all** registered tools plus hardcoded native tools, regardless of context:

```python
def get_agent_tools(conversation_id=None, allowed_skills=None):
    # ... discovers ALL builtin skills ...
    tools.append(codebase_search)
    tools.append(get_terminal_viewport)      # MT5 desktop capture
    tools.append(mt5_dispatch_signal)        # Trading signal dispatch
    tools.append(compact_context)
    tools.append(write_scratchpad)
    return tools
```

**Required Fix — Tool binding per client:**

| Tool | `vscode` | `web` (standard) | `web` (premium sandbox) | `aidock` | `android` |
|---|---|---|---|---|---|
| `workspace_writer` | ✅ (delegated) | ❌ | ✅ (sandbox) | ✅ (mounted vol) | ❌ |
| `workspace_patcher` | ✅ (delegated) | ❌ | ✅ (sandbox) | ✅ (mounted vol) | ❌ |
| `workspace_reader` | ✅ (delegated) | ❌ | ✅ (sandbox) | ✅ (mounted vol) | ❌ |
| `shell_exec` | ✅ (delegated) | ❌ | ✅ (sandboxed) | ✅ (container shell) | ❌ |
| `codebase_search` | ✅ | ❌ (no index) | ✅ (if indexed) | ✅ | ❌ |
| `get_terminal_viewport` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `mt5_dispatch_signal` | ✅ (space-gated) | ✅ (space-gated) | ✅ (space-gated) | ✅ (space-gated) | ❌ |
| `compact_context` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `write_scratchpad` | ✅ | ✅ | ✅ | ✅ | ✅ |

> [!NOTE]
> **User plans** to introduce Cloud Run Sandboxes for premium spaces and lightweight WebContainer functionality to elevate the web app into an IDE-capable environment that can compile agent-generated content safely. Links to review will be shared separately. This means premium Web clients will eventually gain access to filesystem + shell tools executed within a Cloud Run sandbox rather than locally.

---

### Finding 4 — `execute_tool_node` Delegation Is Hardcoded to VSCodex Only

> **Severity: P2 — No extensibility for AIDock or future clients.**

The delegation check at [nodes.py:877](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L877):

```python
is_client_tool = client_type == "vscode" and tool_name in [
    "workspace_writer", "workspace_reader", "shell_exec", "workspace_patcher"
]
```

**AIDock** needs nearly identical delegation semantics (filesystem CRUD + terminal) but via its Docker FastAPI backend, not the VS Code extension host. This check would need **another hardcoded branch**, which doesn't scale.

**Recommended refactor — Client capabilities registry:**

```python
CLIENT_DELEGATED_TOOLS = {
    "vscode": {"workspace_writer", "workspace_reader", "shell_exec", "workspace_patcher"},
    "aidock": {"workspace_writer", "workspace_reader", "shell_exec", "workspace_patcher"},
    "web":    set(),      # No delegation — tools either excluded or run server-side in sandbox
    "android": set(),     # No delegation initially
}
```

The delegation transport for AIDock will need to be designed separately (likely a FastAPI-based tool execution endpoint within the container), but the registry pattern allows clean extension.

---

### Finding 5 — Graph Router `should_continue` Mutates State Directly

> **Severity: P2 — Side-effect in a pure routing function.**

In [graph.py:28](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py#L28):

```python
def should_continue(state: AgentState):
    if has_calls:
        state["is_short_process"] = False  # Direct mutation
```

LangGraph routing functions should be **pure**. This mutation bypasses LangGraph's state update mechanism and makes the promotion invisible to telemetry.

**Recommended fix:** Move the promotion into `execute_tool_node` or `reason_node`.

---

### Finding 6 — `AgentState` Has No `client_type` Field

> **Severity: P2**

[state.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/state.py) defines `AgentState` without a `client_type` field. The routing functions only receive `state` — they cannot access `client_type` because it lives in `config["configurable"]`, which LangGraph does not pass to conditional edge functions.

**Required:** Add `client_type: Optional[str]` to `AgentState`. Populate in `init_node` from `config`.

---

### Finding 7 — Existing Tests Don't Cover Client-Type Variations

> **Severity: P2**

[test_short_process_routing.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/test_short_process_routing.py) uses a `MockConfig` with no `client_type`. All test cases assume a single client context.

**Required:** Expand the test matrix to cover `client_type` in `["vscode", "web", "aidock", "android", None]` × query type.

---

## User Feedback — Resolved Questions

### Q1: Shared tools across portals?
**Answer:** Not yet, but planned via a feature called **"Connex"** — an OAuth + MCP integration panel where users can connect to third-party services. A placeholder already exists in the VSCodex Context tab under the `CONNEX` sub-tab ([chatView.html:6224-6324](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/chatView.html#L6224-L6324)) with Azure, AWS, Google Drive, and Dropbox cards.

**Design implication:** When Connex launches, the tools it surfaces will be **shared across all clients** (since they're cloud-hosted OAuth integrations, not local filesystem tools). The `get_agent_tools()` function should have a `connex_tools` category that is client-agnostic.

### Q2: Web `is_short_process`?
**Answer:** Keep it. The orchestration is not completely broken — the agent still replies correctly. The heuristic just needs tuning for Web-specific query patterns (see Finding 2).

### Q3: AIDock classification?
**Answer:** AIDock is a **Docker container-served web interface** that requires VSCodex-like tool semantics for mounted-filesystem CRUD and terminal command execution via FastAPI (or equivalent). It is **not** a simple Web variant — its tool set matches VSCodex, but its delegation transport is different.

### Q4: A2UI standardization for Android?
**Answer:** A2UI v0.9 is **exclusively** used by the Gemma Code Lab CodexSpace. It should **not** be adapted elsewhere.

**Verified in codebase:**
- Backend renderer: [a2ui_renderer.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/CodexSpaces/backend/agent/a2ui_renderer.py) — produces `application/a2ui+json` only for Code Lab `/codegen` endpoint
- Client renderer: [A2UIRenderer.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/client/src/components/A2UIRenderer.tsx) — imported only in CodexSpaces module
- SpaceCard badge: [SpaceCard.tsx:108](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/codex_spaces/client/src/components/SpaceCard.tsx#L108) — A2UI badge shown only for Code Lab

**No A2UI usage exists outside CodexSpaces.** The earlier proposal to use A2UI for accessibility/Android has been removed from this plan.

### Finding 9 — Sleepy AI Time Checker Leaks Tasks & Causes UI Silence

> **Severity: P2 — Memory leak and poor UX.**

In `backend/api/chat.py`, `run_agent_task()` spawns a new `checker_task = asyncio.create_task(sleepy_ai_time_checker_loop())` on every request, but never cancels it. This causes a compounding memory/task leak per websocket.
Additionally, nodes like `evaluate_turn` and `final_report` invoke the LLM synchronously without streaming tokens. During high-latency LLM calls, the UI appears frozen, leading the user to manually send `"Status?"` queries to "wake it up" (which really just reassures the user that the event loop is alive).

**Required Fix:**
- Refactor the sleepy timer in `chat.py`: Ensure only one timer runs per websocket, or cleanly cancel `checker_task` in a `finally` block at the end of `run_agent_task`.
- Update `current_node_name = "idle"` when graph execution completes.

### Finding 10 — Over-provisioned LLM for Final Report (Deferred)

> **Severity: Info — Wasted latency.**

`final_report_node` uses `tier="reasoning"` (e.g., Claude 3.5 Sonnet or Gemini Pro) just to summarize work.
*Note: Per user feedback, this is currently intended behavior to respect the Globally Selected model. We will defer changes here until the global model selection logic is refactored.*

---

## Proposed Changes

### Phase 1 — Foundation (Minimal Risk)

| File | Change |
|---|---|
| [state.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/state.py) | Add `client_type: Optional[str]` to `AgentState` |
| [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx) | Add `client_type: 'web'` to WS payloads in `handleSend` (L617) and `handleRetry` (L709) |
| [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py) | Default `client_type` to `"web"` when absent; propagate to `initial_state` |

### Phase 2 — Client-Aware Heuristics & Tool Binding

| File | Change |
|---|---|
| [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py) `init_node` | Read `client_type` from config; populate into state; branch `is_short_process` heuristic |
| [tools.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/tools.py) `get_agent_tools` | Accept `client_type` param; filter tools per client capability matrix above |
| [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py) `reason_node` | Pass `client_type` to `get_agent_tools()` |
| [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py) `execute_tool_node` | Replace hardcoded VSCodex check with `CLIENT_DELEGATED_TOOLS` registry (supports `aidock` extension) |

### Phase 3 — Graph Routing & Performance Optimization

| File | Change |
|---|---|
| [graph.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py) `should_continue` | Remove direct state mutation; read `client_type` from state for routing decisions |
| [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py) `run_agent_task` | Fix sleepy-ai-timer leak: cancel `checker_task` in a `finally` block and reset `current_node_name = "idle"` on exit |

### Phase 4 — Testing

| File | Change |
|---|---|
| [test_short_process_routing.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/test_short_process_routing.py) | Expand test matrix: `client_type` × query patterns for `vscode`, `web`, `aidock`, `android`, `None` |

---

## Future Work (Not In Scope)

These items are tracked but **not part of this implementation**:

1. **Connex (OAuth + MCP shared tools)** — Future feature for cross-client service integrations. Placeholder exists in VSCodex Context tab.
2. **Cloud Run Sandboxes + WebContainers** — Premium Web spaces will gain sandboxed filesystem/shell tools. User to share reference links.
3. **AIDock delegation transport** — Requires a separate FastAPI-based tool execution service running inside the Docker container.
4. **AI_Droid (Android)** — Mobile app client with its own reduced tool set and voice-optimized interaction patterns.

---

## Verification Plan

### Automated Tests
- Expand `test_short_process_routing.py` with `client_type` variations.
- Test `get_agent_tools(client_type="web")` returns no filesystem tools.
- Test `get_agent_tools(client_type="vscode")` returns all tools.
- Test `get_agent_tools(client_type="aidock")` returns filesystem tools (same as vscode).

### Manual Verification
- Send `"What is a neural network?"` from the Web client → verify it does **not** short-circuit.
- Send `"Hi"` from Web client → verify it **does** short-circuit (fast-path retained).
- Send `"Hi"` from VSCodex → verify it **does** short-circuit.
- Inspect the system prompt tool binding section for a Web session → confirm no `workspace_writer` / `shell_exec` references.
- Verify Agent Canvas artifact rendering is unaffected on the Web client.
