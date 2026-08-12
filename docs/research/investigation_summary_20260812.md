## Investigation Summary: AICodex vs Pi Agent CLI Orchestration Comparison

**Document created:** `docs/research/agent_orchestration_comparison_20260812.md`

### Key Findings

1. **AICodex orchestration (LangGraph-based):**
   - Fixed node sequence: `init → (planner|reason) → guard → reason → (execute_tool|validate) → verification → guard → reason → ... → evaluate_turn → final_report`
   - 5-tier LLM fallback chain: `ollama_cloud → openrouter → groq → gemini → local` — ALL currently broken
   - Client tool delegation via WebSocket: `client_tool_call` → `handleClientToolCall` → `tool_response`
   - **Fixed bug:** `_isGenerating` gate at `ChatViewProvider.ts:2590` was dropping `client_tool_call` events after `done` — fixed on 2026-08-10
   - Quality guards: `guard` (stuck-loop, context budget), `evaluate_turn` (quality scoring), `handle_blocker` (force finalize)
   - Tool execution has 120s timeout; conditional binding if model lacks "Tools" capability

2. **Pi Agent CLI (loop-based):**
   - Iterative `runLoop()` with `shouldStopAfterTurn` config flag
   - `executeToolCalls()` handles sequential or parallel tool execution inline
   - Single provider per run; no built-in fallback chain
   - `prepareNextTurn` can update model, reasoning level between turns
   - `streamAssistantResponse` returns assistant message + tool calls in one pass
   - Tools executed in same process as LLM — lower latency, more reliable
   - No VS Code-specific API access (different paradigm)

3. **Why AICodex feels "worse" at tool use:**
   - **#1 blocker:** No working LLM provider — agent loop never starts
   - **#2 blocker (now fixed):** `_isGenerating` gate dropping `client_tool_call` after `done`
   - **#3:** Conditional tool binding — if model lacks "Tools" capability, tools silently disabled
   - **#4:** 120s timeout on client tool responses
   - **#5:** Fixed node sequence may not match optimal reasoning path for given task
   - **#6:** No sequential/parallel tool support (one tool at a time)
   - **#7:** Prompt system fragile (file-dependent markdown modules)

4. **Comparison table** covering: agent loop structure, reasoning & tool execution, quality & stagnation detection, fallback & resilience, client-side tool delegation, prompt & memory system

5. **Recommendations:**
   - Short-term: Configure at least one working LLM provider (local Ollama or cloud API key)
   - Short-term: Verify `_isGenerating` gate fix; add `user_input_request` exemption
   - Medium-term: Add sequential/parallel tool support; add fallback chain status logging; add integration tests
   - Long-term: Hybrid approach — keep LangGraph state management/quality guards but simplify tool execution path; prompt system validation

### Files Modified/Created
- `docs/ARCHITECTURE_REVIEW_20260810.md` — full system architecture review
- `docs/research/agent_orchestration_comparison_20260812.md` — AICodex vs Pi CLI comparison

### Root Cause of "Tools Not Executing"
The conversation trace showed: Workers AI rate-limited → Ollama Cloud model not found → Local Ollama not running. The agent loop never starts. The `_isGenerating` gate fix is necessary but not sufficient — a working LLM provider is the #1 requirement.