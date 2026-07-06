# Implementation Plan: Agent Short-Process Routing, Live MTP Diagnostics, & ADK Branding

This plan outlines the steps required to optimize the graph execution path for conversational queries (short processes), implement a live AST & Speculative MTP code diagnostics backend, and visually brand Gemma Code Lab outputs.

---

## Goal Description
1. **Short-Process Routing**: Every query (even greetings or acknowledgments) currently triggers the full multi-turn agentic loop, leading to latency and loop risks. We will implement a heuristic-based fast-path in `init_node` and graph routing.
2. **Google ADK Stack Branding**: Add `"Google ADK Stack"` metadata tags to the A2UI extension outputs and the web client sandbox panel (placed cleanly below the title).
3. **Live AST & MTP Code Diagnostics**: Transition the static mock analysis in the web-client Sandbox panel to a fully dynamic tool. We will add a backend API endpoint `/api/spaces/code-lab/analyze` that calculates real AST metrics, parses python recursion, queries the GenAI model to generate live optimization code, and computes code-specific speculative 4-token prediction steps for the MTP simulator.

---

## Proposed Changes

### 1. Backend: Heuristic Routing & Short-Process Gate (`AI_Codex`)

#### [MODIFY] [state.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/state.py)
* Add `is_short_process: Optional[bool]` to `AgentState`.

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
* Refactor `init_node` to classify the user's query:
  - If the query is a common greeting ("hi", "hello", etc.) or acknowledgment ("thanks", "ok", "yes", "no"), set `is_short_process = True`.
  - If the query length is `< 45` characters and lacks technical action words, set `is_short_process = True`.

#### [MODIFY] [graph.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py)
* Refactor `should_continue` conditional router:
  - If the LLM generates tool calls, dynamically promote the run by setting `is_short_process = False` and routing to `execute_tool`.
  - If no tool calls are generated:
    - If `is_short_process` is `True`, route directly to `END`.
    - If `is_short_process` is `False`, route to `evaluate_turn` (Long process validation).
* Add `END` to the allowed routes mapping for the `reason` node in `create_agent_graph()`.

---

### 2. Backend: spaces.py Live AST/MTP Analyzer (`CodexSpaces`)

#### [MODIFY] [spaces.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/CodexSpaces/backend/api/spaces.py)
* Implement a new endpoint `POST /api/spaces/{slug}/analyze` with Pydantic request/response validation:
  - For Python: uses standard library `ast` to parse the code, compute cyclomatic complexity factors, detect actual recursive function calls, and assign an authentic health score.
  - For other languages: uses regex-based AST heuristics.
  - LLM Integration: invokes `GemmaCodeLabLLM` using the user's Google/Gemini key to produce:
    - Code recommendations and optimized refactored code.
    - Custom 4-token speculative prediction stages representing actual MTP generation of their submitted code.

---

### 3. Backend: A2UI Google ADK Extension Branding (`CodexSpaces`)

#### [MODIFY] [a2ui_renderer.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/CodexSpaces/backend/agent/a2ui_renderer.py)
* Inject a `"Google ADK Stack"` metadata badge component within `render_code_lab_output()` so all output cards generated via Gemma Code Lab render this tag prominently:
  ```python
  badges: list[dict] = [
      a2ui_badge(output.language.upper(), variant="primary"),
      a2ui_badge(f"⚡ {output.model_used}", variant="secondary"),
      a2ui_badge("Google ADK Stack", variant="success"),
  ]
  ```

---

### 4. Web Client: Live Integration & HUD UI Refinement (`AI_Codex/client`)

#### [MODIFY] [GemmaSandboxHarness.tsx](file:///C:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/GemmaSandboxHarness.tsx)
* Update Header Layout: Place the green/blue `"Google ADK Stack"` badge block *below* the `"Gemma Code Lab"` title instead of inline.
* Hook to Backend Analysis:
  - Update `handleAnalyze` to perform a real `fetch` call to `/api/spaces/code-lab/analyze` sending the editor code and language.
  - Map backend response fields to local state: `healthScore`, `complexity`, `recommendation`, `optimizedCode`, `mtpSpeedup`.
  - When the analysis runs, parse and load the `mtp_steps` returned by the backend to feed the speculative decoder simulator, giving a real-world MTP breakdown of their code.

---

## Verification Plan

### Automated Tests
* Run python compilation verification:
  ```powershell
  python -m py_compile c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\agent\state.py c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\agent\nodes.py c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\agent\graph.py c:\AppDev\My_Linkdin\projects\iarxii\CodexSpaces\backend\api\spaces.py c:\AppDev\My_Linkdin\projects\iarxii\CodexSpaces\backend\agent\a2ui_renderer.py
  ```

### Manual Verification
1. **Short-Process Test**:
   - Send "Hi" or "Thanks". Verify the agent executes exactly `init` -> `guard` -> `reason` -> `END` (Exactly 1 LLM call).
2. **Tool Promotion Test**:
   - Send "Create a file test.txt". Verify it generates tool calls, switches to `is_short_process = False`, executes the tool, and completes the long validation cycle.
3. **ADK Stack Extension UI Badge Test**:
   - Request a Code Lab generation. Check that the output card renders a green `"Google ADK Stack"` badge.
4. **Live Code Diagnostics Test**:
   - Open the web client and write some python code in the sandbox (e.g. recursive fibonacci or simple hello world).
   - Press "Run AST & MTP Diagnostics". Verify the backend processes the code, computes actual AST metrics, and returns custom speculative prediction passes.
   - Verify that the `"Google ADK Stack"` badge is rendered cleanly *below* the title.
