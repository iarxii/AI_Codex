# Implementation Plan: Agent Loop Evolution, Memory Compaction & Telemetry

This plan outlines the steps required to implement the state-driven ReAct agent loop, autonomous context compaction tool, double-threshold token tracking settings, Quality Scoring Engine, Consideration Vector, Writeable Scratchpad Plan, and the interactive VS Code sidebar panel telemetry dashboard.

## Architectural Guidelines & Coexistence
* **AI_Codex Parent Agent**: Continues to run on the **LangGraph / LangChain** ecosystem. We are not deprecating the Lang stack. All cyclic ReAct reasoning, tools, and evaluation nodes run in the LangGraph topology.
* **Gemma-Code-Lab Exclusively**: Only the `Gemma-Code-Lab` space utilizes the linear **Google ADK 2.0 / native google-genai SDK** pipeline. It operates stateless and side-by-side with the parent agent. Other spaces (e.g. general, trading) utilize the LangGraph framework.

---

## Proposed Changes

### 1. Backend: State, Graph Engine & Quality Scoring (`AI_Codex`)

#### [MODIFY] [state.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/state.py)
* Add properties to `AgentState` to support loop management, memory telemetry, scratchpad planning, and quality guardrails:
  - `task_goal: str`
  - `execution_artifacts: Dict[str, Any]`
  - `evaluation_report: Dict[str, Any]`
  - `recent_actions_fingerprint: List[str]`
  - `token_metrics: Dict[str, int]`
  - `quality_history: List[float]`
  - `consideration_vector: Dict[str, Any]`
  - `scratchpad: Optional[dict]` # Extends to include: {"retrieved_chunks": [...], "task_plan": "..."}

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
* **Reasoning Node (`reason_node`)**: 
  - Update prompt building logic to look for `consideration_vector` in the state. If present, inject it as an un-evictable system prompt constraint (e.g. specifying focus area and forbidding destructive file/code deletion).
  - Look for `task_plan` inside `scratchpad`. If present, append the plan directly to the system prompt context, ensuring it stays outside message compaction.
  - Update to log consecutive actions/arguments into `recent_actions_fingerprint` to support the stagnation router.
* **Evaluator Node (`evaluate_turn_node`)**: Implement quality assessment logic:
  - Evaluate syntactic and semantic correctness.
  - Assess lines added vs. deleted from the execution artifacts.
  - Output a `quality_score` (0.0 to 1.0) and a structured `consideration_vector` (`priority`, `anti_pattern_guard`, `focus_area`).
  - Store score in `quality_history`.
* **Synthesis Node (`final_report_node`)**: Summarize execution trail and output actionable next steps.

#### [MODIFY] [graph.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py)
* Register the new nodes: `evaluate_turn` and `final_report`.
* Refactor graph connections and conditional routers:
  - Connect `reason` (if no tool calls) -> `evaluate_turn`.
  - Connect `evaluate_turn` -> conditional routing decision (`route_after_evaluation`):
    - If task complete -> `final_report`.
    - If stuck/stagnating -> `handle_blocker` (graceful degradation state).
    - If quality degrades (i.e. last 3 quality scores in `quality_history` are descending, or excessive lines deleted) -> `handle_blocker`.
    - If incomplete and safe -> `inject_self_command` -> `guard` -> repeat loop.

#### [MODIFY] [tools.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/tools.py)
* Implement the python-based `compact_context` tool that splits history into:
  - Unmodifiable system instructions and configurations.
  - Active tail (last 4 turns).
  - Intermediate history (condensed via validation LLM into a high-density summary).
* Implement the `write_scratchpad` tool which saves a markdown checklist/plan inside `state["scratchpad"]["task_plan"]`.
* Expose `compact_context` and `write_scratchpad` inside `get_agent_tools()`.

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
* Update WebSocket `/ws/agent` execution block to support streaming the new node steps.
* Stream a new event payload type: `type: "context_telemetry"` when token thresholds are reached.

---

### 2. Frontend: VS Code Extension UI (`vscode-extension`)

#### [MODIFY] [package.json](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/package.json)
* Register settings properties inside the extension settings contribution:
  - `vscodex.token.warningStop` (default: 250,000)
  - `vscodex.token.maxStop` (default: 1,000,000)
* Register the webview-based view `spirit-bird-context-window` inside sidebar views container `spirit-bird-sidebar`.

#### [NEW] [ContextWindowPanelProvider.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/views/ContextWindowPanelProvider.ts)
* Create the VS Code Webview provider class:
  - Resolve webview HTML containing styled progress rings (Input vs. Memory vs. Free allocation).
  - Implement dynamic message listener to catch `updateMetrics` messages and update UI state/velocity sparklines dynamically.

---

## Verification Plan

### Automated Tests & Local Execution
1. Run local test suite to ensure existing LangGraph and OllamaOpt endpoints remain stable.
2. Trigger WebSocket communication via local client harness and inspect payload telemetry:
   ```bash
   python scratch/test_graph.py
   ```

### Manual Verification
1. Open the VS Code Extension in Extension Development Host.
2. Confirm the **Context Window Panel** is mounted in the sidebar and displays mock statistics.
3. Run a chat command that triggers high context usage (e.g. read heavy files) and verify that:
   - The warning banner fires when crossing the Warning Stop.
   - The compaction tool runs successfully and crunches the memory footprint down in the sidebar visual panel.
4. Intentionally introduce a syntax error and verify that:
   - The evaluator computes a lower quality score.
   - The consideration vector tells the reasoning model to avoid deletion.
   - If the error persists and quality degrades further, the loop halts gracefully and transitions to `handle_blocker`.
5. Verify the active plan checklist stays populated even after context compaction occurs.
