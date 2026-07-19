# Implementation Plan: AICodex System Enhancements

This plan outlines the implementation of three major system enhancements based on the Copilot harness analysis and user feedback.

## Proposed Enhancements
1. **Conductor-Executor Split (Planner Node):** Introduce a dedicated planning stage at the beginning of complex turns that writes a checklist to the persistent scratchpad (`scratchpad["task_plan"]`).
2. **Error-Aware Tool Output Compression:** Automatically compress large tool outputs (> 4,000 characters) while preserving tracebacks, compiler messages, and test failures. Add a fallback tool (`read_full_tool_output`) to fetch the unpruned log if needed.
3. **Self-Healing Tool Exceptions:** Wrap tool executions to intercept errors/exceptions and append actionable, developer-friendly diagnostic hints.

---

## Proposed Changes

### 1. Agent Tools & Fallback log reader
#### [MODIFY] [tools.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/tools.py)
* Define and export the `read_full_tool_output` tool using `StructuredTool.from_function`.
* This tool reads from a temporary file `logs/last_tool_output.log` which stores the unpruned output of the last executed tool.
* Register `read_full_tool_output` in `get_agent_tools()`.

### 2. Graph Nodes Optimization & Planner
#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
* **[NEW]** Define `planner_node(state, config)`:
  * Analyzes the user request and compiles a step-by-step task checklist using the reasoning model tier.
  * Outputs tasks in the schema: `[{"text": "description", "done": False}]`.
  * Skips planning if `scratchpad["task_plan"]` is already populated or if it is a `is_short_process` fast-track execution.
  * Broadcasts progress status updates to the UI WebSocket.
* **[MODIFY]** Update `execute_tool_node`:
  * Intercept exceptions inside tool execution block and append specific diagnostic hints depending on tool type (e.g., directory mismatch tips for `workspace_writer`, whitespace alignment/search match tips for `workspace_patcher`, executable/venv tips for `shell_exec`).
  * Implement `compress_tool_output(output, max_chars=4000)`:
    * Scans the log lines.
    * Identifies and flags lines containing critical keywords (e.g., `FAIL`, `ERROR`, `EXCEPTION`, `WARNING`, traceback traces).
    * Preserves the flagged lines along with a sliding window of 2 lines before and 2 lines after.
    * Preserves the first 15 and last 15 lines of the output as boundaries.
    * Discards verbose output segments and inserts a clear instruction: `[OMITTED N lines. Call read_full_tool_output to read raw log]`.
    * Always writes the full, unpruned result to `logs/last_tool_output.log` before compression.

### 3. Graph Routing
#### [MODIFY] [graph.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py)
* Register `"planner"` node.
* Modify the routing flow:
  * Route `init` -> `planner` (non-trading) or `init` -> `trading_debate` -> `planner` (trading).
  * Route `planner` -> `guard` -> `reason`.
  * This ensures planning runs once before reasoning starts.

### 4. Verification Suite
#### [NEW] [test_enhancements.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/test_enhancements.py)
* Build automated tests to verify:
  * `planner_node` generates and populates task lists.
  * `compress_tool_output` correctly retains error lines and truncates huge noise logs.
  * Tool exceptions produce structured, self-healing diagnostic tips.

---

## Verification Plan

### Automated Tests
Run the newly created unit test suite and verify routing checks:
```powershell
python -m backend.test_enhancements
python -m backend.test_short_process_routing
python -m unittest discover -s backend -p "test_*.py"
```

### Manual Verification
Confirm that WebSocket messages are broadcast during planning and that tool executions do not lose compiler context on large files.
