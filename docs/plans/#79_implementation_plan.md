## Comprehensive Plan: Implementing Context Engineering Techniques for AICodex Agentic Harness

Based on my analysis of the codebase and the research document, here's a detailed implementation plan for integrating the four context engineering techniques from the `Augmenting_Open-Source_Models_Performance.md` document into the AICodex Agentic Harness on the `agent/context/enhance` branch.

---

### **Current State Analysis**

**What Already Exists (Partial Implementation):**
| Technique | Current Status | Location |
|-----------|----------------|----------|
| Environmental Sandboxing | Partial - OllamaOpt ContextBuilder budgets tool outputs | `backend/OllamaOpt_local/cli/context/builder.py`, `backend/integrations/ollamaopt_bridge.py` |
| Trajectory Pruning | Partial - `compress_tool_output()` + `compact_context` tool | `backend/agent/nodes.py:855`, `backend/agent/tools.py:268` |
| Structured Scratchpad (ReSum) | Partial - `write_scratchpad` tool + `planner_node` | `backend/agent/tools.py:277`, `backend/agent/nodes.py:904` |
| Dynamic Tool Set Filtering | Partial - Capability-based filtering | `backend/agent/nodes.py:596`, `backend/agent/tools.py:80` |

**Key Gaps:**
1. Techniques are **not integrated cohesively** - they exist as isolated utilities
2. **No unified state schema** matching the research document's `AgentState` with `sandboxed_vars`, `phase`, structured `scratchpad`
3. **Missing `scratchpad_node`** that forces LLM to output structured JSON updates each turn
4. **No phase-based tool binding** (DISCOVERY vs EXECUTION)
5. **No automatic trajectory pruning** in the main message flow - only on-demand via tool

---

### **Implementation Plan**

#### **Phase 1: State Schema Unification** (Foundation)

**File: `backend/agent/state.py`**
- Extend `AgentState` to match research document's unified schema:
  ```python
  class AgentState(TypedDict):
      messages: Annotated[list[BaseMessage], add_messages]
      sandboxed_vars: dict[str, str]          # NEW: Environmental Sandboxing
      scratchpad: dict                        # ENHANCE: Structured with active_goal, completed_steps, current_blocker, next_action
      phase: str                              # NEW: DISCOVERY | EXECUTION
      # ... existing fields (telemetry, context_data, etc.)
  ```
- Add Pydantic model for structured scratchpad (`AgentScratchpad`) matching research doc

#### **Phase 2: Environmental Sandboxing** (Technique 1)

**Files to Modify/Create:**
1. **`backend/agent/tools.py`** - Create `execute_tool_sandboxed()` wrapper
   - Intercept ALL tool executions in `execute_tool_node`
   - If output > 500 chars → store in `state["sandboxed_vars"]` with handle `VAR_LOG_{n}`
   - Return truncated summary with preview to LLM
   - Add `read_full_tool_output` tool already exists - ensure it reads from `sandboxed_vars`

2. **`backend/agent/nodes.py`** - Modify `execute_tool_node` to use sandboxing wrapper
   - Apply to ALL tools (not just shell_exec)
   - Update `sandboxed_vars` in state return

#### **Phase 3: Trajectory Pruning** (Technique 2)

**Files to Modify:**
1. **`backend/agent/nodes.py`** - Add `prune_trajectory()` function (from research doc)
   - Mask ToolMessages older than last 3 turns: `"[Output pruned by harness. Task executed successfully.]"`
   - Keep last 3 messages fully intact

2. **`backend/agent/graph.py`** - Integrate pruning into message flow
   - Call `prune_trajectory()` in `reason_node` before building context
   - OR add as a preprocessing step in `build_compressed_context()`

#### **Phase 4: Structured Scratchpad / ReSum** (Technique 3)

**Files to Create/Modify:**
1. **`backend/agent/nodes.py`** - Add `scratchpad_node()` 
   - Uses `base_llm.with_structured_output(AgentScratchpad)`
   - Prompt: "Review conversation and update structured agent scratchpad"
   - Runs after each turn (when no tool calls)

3. **`backend/agent/graph.py`** - Add `update_scratchpad` node and routing
   - Conditional edge: `reason` → `tools` OR `update_scratchpad`
   - `update_scratchpad` → `END` (or back to `guard` for next turn)

4. **`backend/agent/state.py`** - Ensure `scratchpad` field has proper structure

#### **Phase 5: Dynamic Tool Set Filtering** (Technique 4)

**Files to Modify:**
1. **`backend/agent/nodes.py`** - Modify `reason_node` tool binding logic
   - Add phase detection: `state.get("phase", "DISCOVERY")`
   - **DISCOVERY phase**: Only bind `read_file`, `list_dir`, `search_docs`, `codebase_search`
   - **EXECUTION phase**: Only bind `write_file`, `workspace_writer`, `workspace_patcher`, `shell_exec`, `run_compiler`
   - Auto-transition: when `read_file` called → set `phase = "EXECUTION"`

2. **`backend/agent/graph.py`** - Ensure phase persists in state

#### **Phase 6: Unified Context Compression Pipeline**

**File: `backend/agent/nodes.py`** - Create `build_compressed_context()` function
- Combines all techniques:
  1. Call `prune_trajectory(messages)`
  2. Extract scratchpad summary
  3. Build system prompt with scratchpad + tool binding status
  4. Return compact stack: `[system_prompt] + pruned_messages[-4:]`

**Integration Point:** Call this in `reason_node` instead of current context building

#### **Phase 7: Graph Restructuring**

**File: `backend/agent/graph.py`** - Restructure to match research document pipeline:
```
START → init → agent → (tools | update_scratchpad)
              ↑         ↓
              ← tools ←
              ↑
         update_scratchpad → END
```
- Add `scratchpad_node` as `update_scratchpad`
- Conditional routing: `should_continue` checks `tool_calls` vs no tool calls
- Remove/replace some existing nodes that duplicate functionality

---

### **Key Design Decisions Needed**

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Scratchpad update frequency** | Every turn vs every N turns | Every turn (as per research doc) |
| **Phase transition trigger** | First `read_file` vs explicit planner decision | First `read_file` (heuristic from research doc) |
| **Sandbox threshold** | 500 chars (research) vs 1000 chars (current) | 500 chars (more aggressive for small models) |
| **Pruning window** | Last 3 messages (research) vs last 4 (current compact_context) | Last 3 (research doc) |
| **Backward compatibility** | Full rewrite vs incremental | Incremental - keep existing nodes, add new ones alongside |

---

### **Files to Modify Summary**

| File | Changes |
|------|---------|
| `backend/agent/state.py` | Add `sandboxed_vars`, `phase`, enhance `scratchpad` structure |
| `backend/agent/nodes.py` | Add `prune_trajectory()`, `build_compressed_context()`, `scratchpad_node()`, modify `reason_node`, `execute_tool_node` |
| `backend/agent/graph.py` | Add `update_scratchpad` node, restructure edges, add conditional routing |
| `backend/agent/tools.py` | Add `execute_tool_sandboxed()` wrapper |
| `backend/integrations/ollamaopt_bridge.py` | Ensure ContextBuilder works with new state schema |

---

### **Testing Strategy**

1. **Unit Tests**: 
   - `prune_trajectory()` preserves last N messages, masks older ToolMessages
   - `execute_tool_sandboxed()` correctly stores large outputs
   - `scratchpad_node()` produces valid `AgentScratchpad` JSON

2. **Integration Tests**:
   - Full graph execution with all 4 techniques active
   - Verify phase transition DISCOVERY → EXECUTION
   - Verify context compression reduces token count

3. **Benchmark**:
   - Compare token usage before/after on sample coding tasks
   - Target: 40-60% token reduction for multi-turn tasks

---

### **Risks & Mitigations**

| Risk | Mitigation |
|------|------------|
| Breaking existing tool execution flow | Keep `execute_tool_node` signature, add sandboxing as wrapper |
| Scratchpad LLM calls add latency | Use smaller/faster model for scratchpad updates (tier="validation") |
| Phase-based tool binding too restrictive | Allow override via config; default to all tools if phase detection fails |
| Context pruning loses critical info | Preserve system prompt + last 3 messages + scratchpad summary always |

---

### **Next Steps**

1. **Confirm approach** - Review this plan with you
2. **Start Phase 1** - Update `state.py` with unified schema
3. **Incremental implementation** - Each phase can be tested independently
4. **Maintain branch** - All changes on `agent/context/enhance`

---

**Questions for you:**

1. **Scratchpad Model**: Should the `scratchpad_node` use the same model tier as reasoning ("reasoning") or a cheaper/faster tier ("validation")? The research doc uses the base model.

2. **Phase Detection**: The research doc uses a simple heuristic (first `read_file` → EXECUTION). Should we also support explicit phase setting via planner?

3. **Backward Compatibility**: Should we deprecate the existing `compact_context` tool and `summarize_history` function, or keep them as fallbacks?

4. **Token Budget**: The research doc uses 500-char sandbox threshold. The current `compress_tool_output` uses 4000. Which threshold should we standardize on?

5. **Testing**: Do you have a preferred test suite or should I create new integration tests?

Let me know your preferences and I'll proceed with implementation.