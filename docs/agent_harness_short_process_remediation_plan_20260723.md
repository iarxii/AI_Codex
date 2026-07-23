# Agent Harness Short-Process Remediation Plan

Date: 2026-07-23

## Objective

Make conversational VSCodex requests complete after one response-generation LLM call while preserving the full ReAct workflow for requests that require tools, artifacts, verification, or iterative correction.

## Status

The backend routing and VSCodex protocol/status portions of this plan were implemented on 2026-07-23. The plan remains open only for authenticated WebSocket lifecycle integration tests and interpreter-environment cleanup for the Pylance diagnostic.

## Implementation changes

### 1. Separate intent from model context

- Implemented `raw_prompt` in the VSCodex WebSocket payload.
- Implemented a separate `context` object containing `workspace` and `attachments`; retrieval and MCP data remain in `scratchpad`.
- The backend uses `raw_prompt` for short-process classification.
- The model continues receiving the enriched `message` content for IDE-aware reasoning.
- The backend falls back to `message` when older clients omit `raw_prompt`.

### 2. Centralize classification

- Extract the heuristic into a pure classifier with an explicit result containing:
  - process mode (`short` or `long`);
  - classification reason;
  - client type;
  - detected action indicators.
- Classify greetings and acknowledgments as short.
- Classify short VSCodex questions as short only when they contain no action, path, or file indicators.
- Store the classification in `AgentState` and telemetry before graph routing.

### 3. Create a real short graph path

- Implemented direct `init` to `reason` routing for short requests.
- Long requests retain planner and guard routing; the trading-space branch remains available for long work.
- Short reasoning suppresses tool binding and does not enter planner or guard.
- The short path retains one streamed response-generation call.
- The long ReAct path remains available for tool-driven work.

### 4. Make tool calls authoritative

- Implemented tool-call-first routing.
- Tool calls route to the normal executor or trading enforcer.
- `reason_node` persists `is_short_process=False` and promotion metadata when a tool call is emitted.
- Routing regression coverage proves a false-positive short classification cannot skip tool execution.

### 5. Reduce unnecessary long-path calls

- Clean classified responses without action/file/path, tool, or artifact evidence now skip validation/evaluation/final-report nodes.
- Keep validation for responses that claim file or command execution without tool evidence.
- Keep evaluation and final reporting for tool/artifact workflows where completion quality must be checked.
- Add explicit per-request limits for graph iterations and elapsed time; the current defaults are 80 iterations and 300 seconds, clamped to 20-120 iterations and 30-900 seconds.

### 6. Improve routing observability

- Implemented an early `routing` WebSocket event after initialization/classification.
- The event includes process mode, reason, client type, and current node.
- Telemetry tracks node sequence, LLM-call count, process mode, classification reason, and tool promotion.
- Existing token streaming, final telemetry, `Ready`, and terminal `done` events are preserved.
- VSCodex now renders backend routing status instead of setting `planning` unconditionally.

## Interface changes

The WebSocket request now contains `raw_prompt`, compatibility `message`, and a structured `context` object. The incoming event union contains a `routing` event. Telemetry gains `process_mode`, `classification_reason`, `node_sequence`, `tool_promotion`, and `llm_call_count` without removing existing fields.

## Test plan

1. Unit-test raw prompts independently from workspace-enriched context.
2. Test greetings, acknowledgments, short questions, action words, file extensions, and paths.
3. Test short graph node sequence: `init → reason → END`.
4. Test long graph node sequence and planner behavior.
5. Test tool-call promotion from an initially short state.
6. Test that short mode suppresses planner, validation, evaluation, and final report.
7. Test WebSocket routing, token, telemetry, status, and `done` ordering.
8. Test loop, timeout, and retry limits.
9. Preserve regression coverage for VSCodex client-delegated tools.

The routing/unit portion is implemented and passing. The remaining item is a deterministic authenticated WebSocket lifecycle suite covering event order, timeout handling, and terminal behavior without requiring a live provider.

## Acceptance criteria

- [x] Raw user intent is unaffected by workspace context size.
- [x] Short conversational requests use one response-generation LLM call.
- [x] Short requests do not enter planner, validator, evaluator, or final-report nodes.
- [x] Any emitted tool call always enters tool execution.
- [x] VSCodex shows the actual process mode instead of always showing planning.
- [x] Long tasks retain planning, tool execution, verification, and self-correction.
- [ ] Focused authenticated WebSocket lifecycle tests cover routing and event ordering.

## Rollout and compatibility

- Preserve the existing `message` field as a fallback for older clients.
- Preserve unrelated working-tree changes in `cli` and `vscode-extension`.
- Roll out backend routing telemetry before relying on the new client rendering.
- Use node-sequence and LLM-call-count telemetry to compare behavior before and after the change.

