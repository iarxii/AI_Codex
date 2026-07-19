# Agent Orchestrator Optimization — Deep Review & Hardening

A comprehensive audit of `graph.py`, `nodes.py`, `chat.py`, `tools.py`, `trading_nodes.py`, and supporting modules to eliminate client-facing internal debug labels, fix architectural defects, remove code duplication, and elevate the agent workflow to production quality.

---

## User Review Required

> [!IMPORTANT]
> **Sleepy-AI-Time-Checker exposure:** The internal debug label `"sleepy-ai-time-checker"` is leaked to clients via:
> - WebSocket `status` messages (visible in UI status bars)
> - `print()` statements on the server console (lower priority but still unprofessional)
>
> This plan replaces ALL client-facing occurrences with professional status language while retaining the heartbeat mechanism itself.

> [!WARNING]
> **Breaking change for frontend:** The WebSocket `status` field text will change from `"sleepy-ai-time-checker: Node 'reason' is active (12.3s)"` to `"Processing: Node 'reason' is active (12.3s)"`. Any frontend code doing exact-string matching on the old label will break. The `type: "status"` key and `node` field remain unchanged.

---

## Findings Summary

### Finding 1 — Internal Debug Label Exposed to Clients *(Critical)*

The `"sleepy-ai-time-checker"` label appears in **6 locations** across `chat.py`. Four of those are `print()` calls (server-side only), but **two are sent directly to the client** via `websocket.send_json()`:

| File | Line | Exposure Level |
|------|------|----------------|
| `chat.py:107` | `print()` → server log | Server-side |
| `chat.py:110` | `websocket.send_json()` → **CLIENT** | **Client-facing** |
| `chat.py:117` | `print()` → server log | Server-side |
| `chat.py:711` | `print()` → server log | Server-side |
| `chat.py:716` | `websocket.send_json()` → **CLIENT** | **Client-facing** |

**Fix:** Replace all `print()` with `logger.debug()` and rewrite client-facing `status` strings with professional labels like `"Processing"` / `"Agent active"`.

---

### Finding 2 — `mql5_execution_enforcer_node` Returns Raw `state` *(Bug)*

In `trading_nodes.py:106`, the non-vetoed path does `return state`. LangGraph nodes must return **partial state updates** (a dict of changed keys), not the full state. Returning the entire state causes every key to be merged again and can corrupt `messages` via the `add_messages` reducer (messages get duplicated).

**Fix:** Return `{}` (empty update) on the non-vetoed path.

---

### Finding 3 — Duplicate MCP Tool Wrapping Logic *(DRY Violation)*

The MCP tool wrapping block (creating `StructuredTool` from scratchpad `mcp_tools`) is **copy-pasted verbatim** in two locations:
- `nodes.py` `reason_node` (lines ~583–614)
- `nodes.py` `execute_tool_node` (lines ~888–908)

Both include the same `dummy_coroutine`, `lambda` func, and deduplication check. This is a maintenance hazard — any bug fix to one copy must be manually duplicated.

**Fix:** Extract into a shared `_bind_mcp_tools(tools, mcp_tools_list, ...)` helper in `tools.py`.

---

### Finding 4 — Duplicate Tool Rebuilding Per Node *(Performance)*

`get_agent_tools()` is called **twice per turn** — once in `reason_node` and once in `execute_tool_node`. Each call runs `registry.discover_builtin_skills()`, iterates all skills, wraps closures, and filters by capabilities. For a typical 3-tool-call turn, this is 6 redundant skill discovery cycles.

**Fix:** Build the tool list once in `reason_node` and pass it forward via state (e.g., `state["bound_tools"]`), or cache per-request in `AgentState`.

---

### Finding 5 — `json` Imported Inside Loops *(Minor Performance)*

`import json` appears inside for-loops in `guard_node` (line 346) and `reason_node` (line 847). While Python caches module imports, placing them inside hot loops is an anti-pattern.

**Fix:** Move to module-level imports.

---

### Finding 6 — `graph.py` Line 12 Logs at Import Time

```python
logger.info("Starting graph construction")
```

This fires whenever the module is imported (including during tests, REPL probing, etc.), not when a graph is actually being constructed. It produces noise in logs.

**Fix:** Move inside `create_agent_graph()`.

---

### Finding 7 — `graph.py` Line 8 Stale Comment

```python
from .trading_nodes import bull_bear_debate_node, mql5_execution_enforcer_node  # or INFO, WARN, ERROR …
```

The `# or INFO, WARN, ERROR …` comment is a leftover from a logging import and is nonsensical here.

**Fix:** Remove the stale comment.

---

### Finding 8 — `after_enforcer` Defined Inside `create_agent_graph`

The routing function `after_enforcer` is defined as a closure inside `create_agent_graph()` at line 181. All other routing functions (`should_continue`, `route_after_evaluation`, etc.) are defined at module level. This inconsistency hurts readability.

**Fix:** Promote to module-level.

---

### Finding 9 — `nodes.py:257` Uses `print()` Instead of `logger`

```python
print(f"ERROR: Failed to initialize LLM for provider {provider}: {e}")
```

Every other error path in the file uses `logger.error()`. This one uses `print()`, which bypasses log formatting, levels, and routing.

**Fix:** Replace with `logger.error()`.

---

### Finding 10 — Redundant Early Auth Check in `chat.py` *(Duplicate Logic)*

`chat.py` lines 367–376 performs an early auth check for cloud providers, but `reason_node` in `nodes.py` (lines 507–555) **already performs the same check** with a more sophisticated fallback chain. The `chat.py` version is stricter (blocks immediately with no fallback) and can short-circuit the fallback logic in `reason_node`.

**Fix:** Remove the redundant check in `chat.py` and let the graph's own `reason_node` handle auth resolution with its full fallback chain.

---

### Finding 11 — `content_preview` in `should_continue` May Leak Sensitive Data

```python
content_preview = str(getattr(last_message, "content", ""))[:200]
```

This is logged at `INFO` level. If messages contain API keys, PII, or sensitive user content, it would appear in production logs.

**Fix:** Reduce to `DEBUG` level.

---

### Finding 12 — `validate` Node Unreachable in Current Graph

The `validate` node is registered (line 116) and has conditional edges (lines 171–178), but no **incoming edge** in the current graph topology. The comment at line 102–107 says `reason → validate`, but the actual `should_continue` router goes to `execute_tool` or `evaluate_turn` — never to `validate`.

The validate logic (fabrication detection) is valuable but is currently dead code.

**Fix:** Wire `validate` as a pass-through between `evaluate_turn` and `final_report`, or explicitly invoke it on the non-tool-call path before `evaluate_turn`. Since this is a significant architectural decision, I'll add it after evaluator and before final report for now.

---

## Proposed Changes

### Component 1: Sleepy-AI-Time-Checker Cleanup

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)

1. Replace all `print(f"[sleepy-ai-time-checker]...")` with `logger.debug(f"[HeartbeatMonitor]...")`.
2. Rewrite client-facing `status` field from `"sleepy-ai-time-checker: ..."` to professional labels:
   - `"Processing: Node '{node}' is active ({elapsed:.1f}s)"` for heartbeat
   - `"Agent active: Node '{node}' is processing ({elapsed:.1f}s)..."` for client status query
3. Add `logger = logging.getLogger(__name__)` near the top of the file (currently relies on `print()` + `log_debug`/`log_error`).

---

### Component 2: Trading Nodes Bug Fix

#### [MODIFY] [trading_nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/trading_nodes.py)

- Line 106: Change `return state` to `return {}` to prevent full-state re-merge.

---

### Component 3: Code Deduplication & Module Hygiene

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)

1. Move `import json` to module-level (remove from inside loops in `guard_node` and `reason_node`).
2. Replace `print()` at line 257 with `logger.error()`.
3. Extract duplicated MCP tool wrapping into a helper call (defined in `tools.py`).
4. Replace duplicated `get_agent_tools()` call in `execute_tool_node` with state-forwarded tools OR at minimum remove the redundant MCP wrapping block.

#### [MODIFY] [tools.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/tools.py)

- Add `bind_mcp_tools(tools, mcp_tools_list, model, is_short_process)` helper function.

---

### Component 4: Graph Topology Fixes

#### [MODIFY] [graph.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py)

1. Remove stale `# or INFO, WARN, ERROR …` comment on line 8.
2. Move `logger.info("Starting graph construction")` inside `create_agent_graph()`.
3. Promote `after_enforcer` closure to module-level function.
4. Reduce `should_continue` log from `INFO` to `DEBUG`.
5. Wire `validate` node on the path from `evaluate_turn` → `final_report` so fabrication detection is reachable.

---

### Component 5: Remove Redundant Chat Auth Check

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)

- Remove the early auth check block at lines 367–376 that short-circuits before the graph even runs. The graph's `reason_node` handles this with a proper fallback chain.

---

## Verification Plan

### Automated Tests
- `python -c "from backend.agent.graph import create_agent_graph; g = create_agent_graph(); print('Graph compiled OK')"` — ensures the modified graph compiles without errors.
- Grep for `sleepy-ai-time-checker` across the codebase — should return **zero** results in `.py` files.
- Grep for `print(` in `chat.py` — verify no remaining raw prints (should all be `logger.*`).

### Manual Verification
- Start the server, connect via WebSocket, send a message, and confirm:
  1. Heartbeat status messages use professional labels (no "sleepy-ai-time-checker").
  2. The `"Status?"` interceptor responds with clean language.
  3. Agent loop continues to function (init → guard → reason → execute_tool → verification → guard → ... → final_report → END).
