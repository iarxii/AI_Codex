# Architectural Report: Copilot Harness Patterns vs. AICodex

This report evaluates the engineering patterns outlined in the research document `how_does_copilot_do_it.md` against the current architecture of **AICodex**.

---

## Comparative Analysis Matrix

| Engineering Dimension | GitHub Copilot Agent Harness Pattern | AICodex Implementation Status | Gap / Opportunity |
| :--- | :--- | :--- | :--- |
| **1. The Core Loop** | Bounded state machine with strict run limits (`maxRequests`), contract-first validation, and self-healing error formatting. | LangGraph-driven state machine (`StateGraph`) with a strict `"recursion_limit": 100` and validation nodes. | **Fully Aligned.** Our `validate` node acts as a layer-2 fabrication detector, routing errors back to the guard-reason cycle for a single retry. |
| **2. Context Aggregation** | Lazy-loading workspace context via LSP/Diagnostics APIs; output trimming (`compressOutput`). | Platform-aware skill routing (`skill_routing.py`) and context assembly of semantic search snippets. | **Partially Aligned.** We dynamically prune guidelines by platform (VS Code vs. Web), but lack automatic linter warning inspection or terminal output trimmers. |
| **3. Checkpointing** | Saves workspace and conversation state after every atomic subagent action; resumes rather than restarts. | Graph checkpointing (state saver) and DB persistence (`Message` and `Conversation` models). | **Fully Aligned.** History is persisted to the DB at every user/tool message boundary, enabling clean recovery upon reconnection. |
| **4. Fleet Orchestration** | Strict Conductor (Planner) and worker subagent split, verified by an independent Reviewer. | Multi-node workflow containing specialized nodes (`init`, `trading_debate`, `guard`, `reason`, `validate`, `execute_tool`). | **Partially Aligned.** The `validate` node acts as the "Reviewer." For trading, a `trading_debate` node runs. Executor tasks are handled by a single `execute_tool_node` rather than parallel sub-workers. |
| **5. UI UX Streaming** | Multi-tier streaming (thoughts to chat, tool updates to UI badges, code diffs to side-by-side git preview). | Multi-tier WebSocket updates streaming tokens, intermediate thought logs, and node status updates. | **Fully Aligned.** We decouple node execution state (`Processing: Node '{node}' is active...`) and stream tokens/tool events in real-time. |

---

## Detailed Weighing & Findings

### Finding 1: Core Loop & Robustness
* **Copilot Pattern:** Relies on robust validation boundaries. When a tool throws an error, the harness catches the error, parses it into an actionable natural language explanation, and hands it back to the agent.
* **AICodex Alignment:** 
  * We use LangGraph's native recursion limits to avoid runaway loops.
  * In `graph.py`, the `validate_response_node` detects hallucinated execution (fabricating output without calling tools) and triggers a self-correction pass.
  * **Opportunity [SUPPORTED]:** Design a generic tool execution interceptor. When an exception occurs during tool invocation (e.g. file writing fails, command execution errors), instead of outputting raw tracebacks, the interceptor will structure the output with clear instructions on *why* it failed and *how* the model can recover (e.g. "Permission denied; check file exists and is not locked").

### Finding 2: Context Assembly & Pruning
* **Copilot Pattern:** Only pulls files related to the prompt. Integrates with the IDE's Language Server Protocol (LSP) to read compiler/linter warnings in real time.
* **AICodex Alignment:**
  * We implement a platform-aware prompt skill routing system. A VS Code client gets VS Code specific guidelines, and capabilities are denylist-gated based on credentials.
  * **Opportunity [SUPPORTED]:** Implement intelligent, error-aware output compression for tool outputs. 
    > [!IMPORTANT]
    > **Addressing Context Loss & Pruning Accuracy:**
    > To prevent the pruner from deleting critical logs/tracebacks, we will adopt a multi-layered extraction strategy:
    > 1. **Rule-Based Regex Filtering:** The pruner will scan for compiler/test framework error keywords (e.g., `FAIL`, `Error`, `Exception`, `Warning`, traceback lines) and preserve them, along with a sliding window of 3 lines before and after.
    > 2. **Structural JSON/XML Preservation:** For structured tool returns, it will selectively preserve error messages, keys, and top-level diagnostic summary sections while discarding large data arrays.
    > 3. **Incremental Logging / Paging Fallback:** Provide a `get_remaining_log_context(offset, limit)` tool. If the model determines that the pruned log has missing information (e.g. it sees a stack trace but wants to inspect more environment output), it can programmatically query for specific ranges.

### Finding 3: Multi-Agent Specialization (Planner-Executor Split)
* **Copilot Pattern:** Split high-level architectural planning from execution. The planner outlines a step-by-step document, and workers execute separate sections.
* **AICodex Alignment:**
  * Our graph currently functions as a sequential controller. The reasoning node handles both planning and tool selection in a single run.
  * In the specialized `trading-space` slug, the `trading_debate` node spins up a multi-perspective debate.
  * **Opportunity [SUPPORTED]:** For complex tasks, introduce a dedicated `planner_node` preceding execution. The planner writes a structured step-by-step task manifest (e.g., in a JSON checklist format) to the graph's `scratchpad` state. The reasoning/execution nodes then consume these tasks sequentially, keeping the execution logic focused and preventing context dilution.

### Finding 4: UI/UX Decoupling
* **Copilot Pattern:** Completely decouples back-end state transitions from what the user sees.
* **AICodex Alignment:**
  * Highly aligned. The WebSocket event loop in `backend/api/chat.py` broadcasts `type: "status"` events to client UIs, hiding raw internal state transitions while showing friendly progress badges.
