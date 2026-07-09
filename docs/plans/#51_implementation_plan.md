# Implementation Plan - Orchestration Quality updates & Terminology Alignment

This plan outlines the changes needed to align the agent system prompts, directives, and documentation with the benchmark guidelines. It resolves the "Post-Mortem" terminology contradiction, adds cross-platform compatibility guidelines, integrates generic model optimizations, and establishes a clear document on client-backend marker synchronizations.

## Proposed Changes

### Backend Agent Configuration

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- **Terminology Fix (L1265):** Update the system prompt in `final_report_node` to change the section heading from `### 📋 Execution Post-Mortem` to `### 📋 Execution Summary` to resolve the direct contradiction with Rule 1 of the orchestration guide.
- **Client Stop Condition Alignment (L1288-1296):** Update `handle_blocker_node` to append `[REQUEST_WALL]` to the end of the Pause warning. This ensures the client-side Step-by-Step Auto-Reasoning (SAR) loop terminates immediately upon state stagnation/degradation, rather than continuing to consume API request iterations.

---

### Agentic Directives & Documentation

#### [MODIFY] [agent_orchestration_quality_updates_guide_20260709.md](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/agent_orchestration_quality_updates_guide_20260709.md)
- **Enhance Rule 4 (Trust, but Verify):**
  - Add guidelines for cross-platform, Windows-compatible readiness polling. Provide concrete inline Node.js and Python command-line examples to replace raw `curl -s` calls.
- **Add Rule 5 (Optimizations for Local & Remote Models):**
  - Generalize the benchmark findings across all models (not just Gemma4).
  - **Error Log Truncation:** Instruct the agent to capture and analyze only the relevant tail of compiler/test runner logs (e.g., the last 30-50 lines) to avoid context bloat.
  - **Strict Exit Codes:** Ensure custom verification scripts return non-zero exit codes (e.g., `process.exit(1)` in Node or `sys.exit(1)` in Python) to enable deterministic outcome checks.
  - **Windows Command Safety:** Remind the agent to avoid Linux-specific shell constructs (like `&&`, `|`, `grep`, or bash scripts) when executing commands in a Windows environment, opting for Python/Node scripts or PowerShell-compatible commands.

#### [NEW] [blocker_and_wall_markers_guide.md](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/docs/blocker_and_wall_markers_guide.md)
- Create a clear architectural documentation file describing the interaction between:
  1. The **Client-side SAR Loop** (run by the VS Code extension `SpiritBirdClient` in `client.ts` / `v2_client.ts`).
  2. The **Backend LangGraph Loop** (run by the Python backend in `nodes.py` / `graph.py`).
- Define the Stop Condition contract:
  - **Goal Markers:** `[GOAL_REACHED]`, `<goal_reached/>`, `FINAL_ANSWER:` — what they signify and when the backend emits them.
  - **Wall Markers:** `[REQUEST_WALL]`, `<request_wall/>`, `AWAITING_USER:` — how the backend's `handle_blocker_node` maps to these to stop the client loop cleanly.

## Cascading Change-Implications & Dependency Analysis

1. **Parser & Client-Side Impact:**
   - We scanned all TypeScript, TSX, JS, and JSON files in the workspace (including the VS Code extension and CodexSpaces web-client) for references to `Post-Mortem` or `PostMortem`. 
   - **Result:** No programmatic dependencies or regex parsers look for this heading; it is rendered purely as general Markdown. Changing it to `### 📋 Execution Summary` is 100% safe.
2. **SAR Loop Markers (`[GOAL_REACHED]` & `[REQUEST_WALL]`):**
   - The extension's client-side SAR loop (`client.ts` and `v2_client.ts`) listens for `[GOAL_REACHED]` to stop execution and `[REQUEST_WALL]` to stop on blockers.
   - Updating `handle_blocker_node` to output `[REQUEST_WALL]` directly aligns backend behavior with the client's parser, resolving a silent token-wastage bug where the client would otherwise loop until reaching its maximum iteration limit on stagnation.
3. **OS-Level Command Failures (Windows):**
   - Since the agent runs terminal commands on a Windows host, shell commands like `curl` (which behaves differently under PowerShell) or `rm -rf` will fail.
   - The proposed guide enhancements directly mitigate this by teaching the agent to use cross-platform node/python wrappers.

## Verification Plan

### Manual Verification
1. **Verify Terminology Alignment:**
   - Run a sample long-horizon generation task and verify that the final agent response contains `### 📋 Execution Summary` instead of `### 📋 Execution Post-Mortem`.
2. **Verify Blocker Stop Condition:**
   - Trigger a blocker condition (or simulate stagnation) and verify that the client SAR loop halts immediately upon receiving `[REQUEST_WALL]` from `handle_blocker_node`.
3. **Verify Guide Readability:**
   - Verify that the updated orchestration guide and new blocker guide render cleanly and are easy to follow.
