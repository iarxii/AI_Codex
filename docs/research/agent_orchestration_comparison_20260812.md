# AICodex vs Pi Agent CLI — Agent Orchestration Comparison

**Date:** 2026-08-12  
**Purpose:** Document key differences in agent orchestration between AICodex (backend LangGraph) and Pi agent CLI (loop-based), explain why quality/tool-use differs

---

## 1. Overview

| Aspect | AICodex (Backend) | Pi Agent CLI |
|--------|-------------------|--------------|
| **Framework** | LangGraph StateGraph (Python) | Custom TypeScript loop (`agent-loop.ts`) |
| **Execution Model** | Cyclic graph with conditional edges | Iterative `for`/`while` loop with `shouldStopAfterTurn` |
| **Reasoning Steps** | Fixed node sequence per turn (guard → reason → execute/validate → evaluate → final_report) | Multiple reasoning steps per turn configurable via config |
| **Tool Execution** | `execute_tool_node` supports **sequential** (one tool at a time, existing behavior) and **parallel** execution (all tools via `asyncio.gather`). Client-delegated tools use WebSocket `client_tool_call` → `tool_response`. Execution mode set via `execution_mode` metadata on each tool ( `"sequential"` or `"parallel"`). | `executeToolCalls` handles sequential/parallel tool calls inline |
| **Quality Guards** | `guard` node (stuck-loop detection, context budget), `evaluate_turn` (quality scoring, stagnation detection), `handle_blocker` | No explicit quality guard node; relies on `shouldStopAfterTurn` config + manual follow-ups |
| **Model Fallback Chain** | **Removed** — single provider per session (user-selected) | Single provider per run; no built-in fallback chain |
| **Client Delegation** | Backend emits `client_tool_call` → extension executes locally → sends `tool_response` | Tools executed inline in the loop; client communication optional |
| **State Management** | `AgentState` TypedDict with telemetry, quality history, evaluation report | `AgentContext` + `AgentLoopConfig` with `shouldStopAfterTurn`, `prepareNextTurn` |
| **Prompt Assembly** | Modular markdown files (`data/profile/*.md`) assembled at runtime | Hardcoded/system prompt + config-driven overrides |
| **Telemetry** | TTFT, latencies, token counts, node sequence, quality history | Basic token counting + optional follow-up messages |
| **Agent Type Support** | web, vscode, aidock, android (client_type field) | Single focus (CLI); no web/vscode variants |

---

## 2. Detailed Comparison

### 2.1 Agent Loop Structure

**AICodex (LangGraph):**
```
init → (planner | reason) → guard → reason → (execute_tool | validate) → verification → guard → reason → ... → evaluate_turn → final_report
```
- Fixed sequence per turn; loops via `guard` → `reason` if stagnation/evaluation says continue
- LangGraph's `checkpoint` / `memory` enables true state persistence across turns
- Conditional edges (`route_after_init`, `route_after_evaluation`) determine next node

Pi CLI:
```
runLoop() → streamAssistantResponse() → checkToolCalls() → executeToolCalls() → loopAgain(config.shouldStopAfterTurn?)
```
- Config-driven: `shouldStopAfterTurn` decides if the loop continues after the current turn
- `prepareNextTurn` can update model, reasoning level, etc. between turns
- More explicit control over when the loop exits

**Key Difference:** Pi CLI gives the user/config more explicit control over loop termination. AICodex's LangGraph forces a pattern that may loop "too many" or "too few" times depending on the task.

### 2.2 Reasoning & Tool Execution

**AICodex:**
- `reason_node` invokes LLM with `bind_tools` (conditional — skipped if model lacks "Tools" capability)
- `execute_tool_node` handles tool execution:
  - **Backend tools** (SQL, git, etc.): runs natively in backend
  - **Client-delegated tools** (workspace_writer, shell_exec, pi_codex_launch, browser_open): emits `client_tool_call` over WebSocket, waits for `tool_response` from client
  - **Execution mode**: tools can be marked `"sequential"` (default, one-at-a-time) or `"parallel"` (execute all concurrently via `asyncio.gather`). Mode set via `execution_mode` attribute on each `StructuredTool`.
  - If tool_result timeout: reports "Error: Tool execution timed out on the client."
- `validate` node checks for fabrication; `verification` does post-execution correction
- Tool calls are **single** per reason cycle typically; no inherent sequential/parallel distinction (depends on LLM prompt)

Pi CLI:
- `executeToolCalls(toolCalls, config)` handles **sequential or parallel** tool calls based on tool metadata
- Tool calls can be emitted one at a time or in batches
- `streamAssistantResponse` returns assistant message + tool call metadata in one pass
- No 120s timeout — tool output is captured and fed back into the next LLM prompt immediately
- Native sequential/parallel support based on tool executionMode metadata
- More fluid tool output integration into next reasoning step

**Key Difference:** Pi CLI's tool execution is more fluid — tool outputs flow naturally into the next reasoning step. AICodex has a harder boundary between `reason` → `execute_tool` → `validate` → `verification` → `reason`, which can feel disjointed. However, AICodex's separate `verification` node provides a correction pass that Pi CLI lacks (relying on the main loop instead). AICodex now also supports parallel tool execution via `execution_mode` metadata, bringing it closer to Pi CLI's capability while retaining LangGraph's state management.

### 2.3 Quality & Stagnation Detection

**AICodex:**
- `guard` node checks: stuck-loop detection (4 identical tool calls), context budget, quality history decline
- `evaluate_turn` node: scores the turn (input/output token counts, latency), compares against `quality_history`, decides if the graph should continue or finalize
- `handle_blocker`: breaks out of persistent error loops; can force transition to `final_report`

Pi CLI:
- No explicit guard/evaluate nodes
- Loop continuation decided by `shouldStopAfterTurn` config flag
- "Steering messages" and "follow-up messages" can be injected between turns
- Relies on the user/config to decide when to stop

**Key Difference:** AICodex has built-in, automated stagnation detection and quality scoring that can terminate or correct the agent without user intervention. Pi CLI requires the config/user to decide when the loop should stop, which is more flexible but less automated.

### 2.4 Fallback & Resilience

**AICodex (Post-Phase 1):**
- **Single provider per session** — user selects one provider in Settings; no auto-fallback chain
- If API key missing for selected provider → clear error to user (no silent fallback)
- Local Ollama available as explicit user choice, not implicit fallback
- Tiered model routing within provider retained (different models for routing/guard vs reasoning/coder)

Pi CLI:
- Single provider per run (configurable)
- No built-in fallback; the user must configure a working provider
- If the provider fails, the loop stops

**Key Difference:** Both now use single-provider model. AICodex retains tiered model routing within the provider (cost optimization), while Pi CLI uses one model per run.

### 2.5 Client-Side Tool Delegation

**AICodex:**
- Backend cannot execute client-side tools (workspace file ops, shell commands, browser) natively
- Must delegate to the client (VS Code extension) via WebSocket
- Prone to the `_isGenerating` gate bug (fixed 2026-08-10) that dropped `client_tool_call` events after `done`
- Backend waits up to 120s for `tool_response`; timeout → error string

Pi CLI:
- Tools executed inline in the Node.js/TypeScript loop
- Can use `child_process`, `fs`, etc. directly
- No separate WebSocket-mediated delegation layer
- Tools and LLM in the same process → lower latency, more reliable

**Key Difference:** AICodex's tool delegation architecture is more complex and was broken until the `_isGenerating` gate fix. Pi CLI's inline tool execution is simpler and more reliable, but cannot access VS Code-specific APIs (file diffs, terminal, solution explorer).

### 2.6 Prompt & Memory System

**AICodex:**
- System prompt assembled from modular markdown files in `data/profile/` (SOUL, USER, MEMORY, AGENTS, SPIRIT_BIRD, etc.)
- `consideration_vector` for strategy constraints
- `recent_actions_fingerprint` for stuck-loop detection
- Skills injected from `skills/mandatory` and `skills/situational`

Pi CLI:
- System prompt from config + optional `convertToLlm` transform
- `skills.ts` defines available skills (harness skills)
- Context window managed via `AgentContext.messages`

**Key Difference:** AICodex's modular prompt system is more sophisticated but fragile (file-dependent, no versioning). Pi CLI's prompt is simpler but more predictable.

---

## 3. Why AICodex Feels "Worse" at Tool Use

Based on the comparison, several factors contribute to the perception that AICodex's agent orchestration is "very bad and fails with tool use":

1. **Broken WebSocket gate** — Until the `_isGenerating` fix, `client_tool_call` events were silently dropped after generation turns ended. This is the most directly fixable issue.

2. **LLM provider chain is broken** — No provider is configured to work. The entire agent loop never starts. This is the #1 blocker.

3. **Conditional tool binding** — If the selected model doesn't advertise "Tools" capability, the agent runs without any tool execution capability, silently. The user may not realize tools are disabled.

4. **120s timeout on client tool responses** — If the extension takes too long to execute a tool (e.g., file operations, shell commands), the backend times out and reports an error.

5. **Linear node sequence** — The fixed `guard → reason → execute_tool → validate → verification → guard → reason` pattern may not match the optimal reasoning path for a given task. Pi CLI's config-driven loop can be more adaptive.

6. **No inherent sequential/parallel tool distinction** (improved) — AICodex passes one tool at a time to the LLM by default. Tools can be marked `"parallel"` via `execution_mode` metadata to enable concurrent execution using `asyncio.gather`. Pi CLI can execute tools sequentially or in parallel based on metadata. AICodex now supports both modes, bringing it closer feature parity with Pi CLI.

7. **Prompt fragility** — The modular markdown prompt system can break if files are missing or malformed. Pi CLI's prompts are more contained.

---

## 4. Summary of Strengths & Weaknesses

| | AICodex Strengths | AICodex Weaknesses | Pi CLI Strengths | Pi CLI Weaknesses |
|---|---|---|---|---|
| **Orchestration** | LangGraph state persistence, automated stagnation/quality detection, configurable fallback chain | Fixed node sequence, complex WebSocket-mediated tool delegation, broken provider chain | Config-driven loop, simple inline tool execution, no fallback chain needed | No state persistence across turns, no automated quality guards, no built-in provider redundancy |
| **Tool Use** | Delegates to VS Code/MCP servers (rich integration), supports 7+ client tool types | Relies on WebSocket + LLM availability, `_isGenerating` gate bug (fixed), 120s timeout | Inline execution, direct `child_process`/`fs` access, sequential/parallel support | Cannot access VS Code-specific APIs, no modular skill system, no automated quality checks |
| **Quality** | Scoring, evaluation, final_report with optional Tutor blocks, handle_blocker | Dependent on LLM/provider working, quality scoring may be too aggressive or not aggressive enough | Manual `shouldStopAfterTurn` + follow-up messages | No automated stagnation detection, no quality scoring, relies on user config |
| **Prompt System** | Modular, extensible, skills injection | File-dependent, no versioning, fragile | Simpler, more predictable | Less extensible, fewer integration points |
| **Provider Resilience** | 5-tier fallback chain | ALL cloud providers broken currently (no keys), local Ollama not running | Single provider assumed working | No fallback; one broken provider = agent dead |

---

## 5. Recommendations

### Short-Term (Fix Current Blockers)

1. **Configure at least one working LLM provider** — local Ollama (`ollama pull llama3.2:3b`) or a cloud API key (Gemini/Groq/OpenRouter). Without this, no amount of orchestration tweaks will help.

2. **Verify the `_isGenerating` gate fix** is deployed — the fix at `ChatViewProvider.ts:2590` ensures `client_tool_call` events are processed after `done`. Test by running a chat and having the agent call `pi_codex_launch` or `browser_open`.

3. **Check model "Tools" capability** — in the extension Settings → Providers, ensure the selected model supports tool use. Some models (especially local Ollama variants) may need `bind_tools=True` explicitly.

### Medium-Term (Improve Orchestration)

4. **Add `user_input_request` exemption** to the `_isGenerating` gate — same class of bug: if the backend asks for user input after `done`, it gets dropped.

5. **Add sequential/parallel tool support** — in `execute_tool_node`, allow tools marked `"parallel"` via `execution_mode` metadata to be executed concurrently using `asyncio.gather`. This brings AICodex closer to Pi CLI's sequential/parallel tool execution capability.

6. **Expose the fallback chain status** — add a health endpoint or log line that shows which provider is active and why others were skipped. Debugging "why isn't the agent using tools?" is currently too opaque.

7. **Add integration tests** for the full WebSocket → agent → tool → response pipeline. Current tests only cover config/settings.

### Long-Term (Architecture)

8. **Consider a hybrid mode** — AICodex's LangGraph provides powerful state management and quality guards, but the provider chain and WebSocket gate are operational liabilities. A "local mode" that runs the LangGraph graph entirely on the client (using the extension's local retriever and MCP tools) without requiring a remote LLM could bypass the provider chain entirely for simple tasks.

9. **Prompt system validation** — add schema validation for the modular markdown prompts at build/test time, not just runtime.

10. **Compare Pi CLI's `shouldStopAfterTurn` + `prepareNextTurn`** with LangGraph's `evaluate_turn` + `handle_blocker`. There may be patterns from the Pi CLI that could improve AICodex's turn-evaluation logic.

---

## 6. Conclusion

The AICodex agent orchestration (LangGraph-based, WebSocket-delgated tool execution, 5-tier fallback chain) is **more sophisticated but more fragile** than the Pi agent CLI's loop-based approach. The Pi CLI gives up some integration richness (no VS Code-specific APIs) in exchange for simpler, more reliable tool execution and loop control.

**The immediate blocker is not the orchestration architecture — it's the LLM provider chain.** Every link in the fallback chain is broken: Workers AI (rate-limited), Ollama Cloud (model not found pointing to localhost), OpenRouter/Groq/Gemini (no API keys), Local Ollama (not running). Until at least one provider works, the agent loop never starts, and no tools can be executed.

The `_isGenerating` gate bug (fixed 2026-08-10) is the second-blocker: even with a working provider, client tool calls after generation turns were silently dropped. This is now fixed.

Going forward, the key question is whether AICodex should maintain its sophisticated LangGraph orchestration + WebSocket tool delegation model, or adopt patterns from the Pi CLI's simpler loop-based approach. A hybrid seems best: keep LangGraph's state management and quality guards, but simplify the tool execution path and ensure the provider chain is operationally viable.

---

*Comparison generated: 2026-08-12*  
*AICodex codebase: v1.3.13*  
*Pi CLI codebase: cli/packages/* (versions matching `start-services.sh` dates)*