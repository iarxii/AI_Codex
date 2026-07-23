# Agent Harness Efficiency Investigation

Date: 2026-07-23

## Executive summary

The `is_short_process` gate exists and its unit tests pass, but the production VSCodex path does not classify the same input that the user typed. VSCodex appends workspace context to the prompt before sending it, while the backend uses the resulting enriched message for length-based classification. A short question can therefore become a long-process request before the graph router sees it.

The gate is also positioned after `init`: a successful short classification still enters `planner`, `guard`, and one `reason` LLM call. The planner skips its internal work, but it remains a graph node and emits UI progress. Finally, the router checks `is_short_process` before tool calls, so a false-positive classification can silently terminate a request that actually requires a tool.

No implementation files were changed during the original investigation. The pre-existing working-tree changes in `cli` and `vscode-extension` must be preserved.

## Evidence and current flow

### Backend classification

`init_node` searches for the latest `HumanMessage` and classifies its complete content. For VSCodex, messages shorter than 45 characters are short unless they contain action words or file extensions. See `backend/agent/nodes.py` around `init_node`.

The extension constructs `fullMessage` from the user prompt, attachments, and workspace context before assigning it to the WebSocket `message` field in `vscode-extension/src/panels/ChatViewProvider.ts`. The classifier consequently measures workspace context as if it were user intent.

An in-memory probe reproduced the mismatch:

```text
raw prompt:                    is_short_process = True
same prompt + workspace data:  is_short_process = False
```

### Current short path

```text
init → planner → guard → reason/LLM → END
```

`planner_node` returns `{}` for a short process, but the node is still entered and its transition is streamed to the client. `guard_node` also performs context inspection before the response-generation call.

The short route only prevents `validate`, `evaluate_turn`, and `final_report` after `reason` completes. It is not an immediate pre-reason response path.

### Current long path

```text
init → planner → guard → reason
  ├─ tool calls → execute_tool → verification → guard → reason
  └─ no tool calls → validate → evaluate_turn
                    ├─ goal achieved → final_report → END
                    └─ otherwise → guard → reason
```

For a substantive answer that does not require tools, this can introduce validation, evaluation, retry, and final-report LLM calls without evidence that the additional layers are needed.

## Root causes

1. **Classification input mismatch.** The backend classifies an enriched model message instead of the raw user prompt.
2. **Late short-path decision.** The graph always passes through planner before the short decision has any routing effect.
3. **Unconditional planning UI.** VSCodex sets its telemetry node to `planning` for every request.
4. **Unsafe router precedence.** `should_continue` checks `is_short_process` before checking `tool_calls`.
5. **Late observability.** Short-process telemetry is only finalized after graph execution, so the client cannot see the classification early.
6. **Insufficient integration coverage.** Existing tests cover raw heuristic inputs and isolated routing, but not the actual VSCodex payload, graph node sequence, or WebSocket event order.
7. **Permissive loop budget.** The WebSocket config allows a recursion limit of 200, which is excessive for a user-facing request without a separate turn/time budget.

## Safety and efficiency impact

- Short conversational requests can incur planner and guard overhead.
- Enriched workspace context can convert intended short requests into long requests.
- A false-positive short classification can end before requested tools execute.
- Non-tool answers can trigger multiple unnecessary LLM calls.
- UI status can report planning even when no plan was generated.
- The absence of an early routing event makes production diagnosis difficult.

## Test evidence

The existing `backend.test_short_process_routing` module passes in the backend virtual environment. It verifies the raw heuristic and the isolated `should_continue` function. It does not verify the VSCodex-enriched payload or end-to-end WebSocket behavior, so passing it does not disprove the production failure.

## Recommended direction

Keep the ReAct loop for evidence-driven work, but make it conditional. Classify raw intent, route short requests directly to one conversational reasoning call, prioritize tool calls over the short flag, and activate validation/evaluation/final-report layers only when tools, artifacts, or verification justify them.

## Implementation update

The first remediation slice was implemented on 2026-07-23. The original statement that no implementation files were changed remains true for the investigation phase only; the current patch includes backend and VSCodex changes.

### VSCodex request changes

`ChatViewProvider` now sends:

- `raw_prompt`: the exact text entered by the user;
- `message`: the enriched model message retained for compatibility and model context;
- `context.workspace`: workspace awareness data;
- `context.attachments`: attached file metadata and contents;
- existing `scratchpad`: retrieval and MCP tool data.

The backend classifies `raw_prompt` and does not use the size of workspace, attachment, or retrieval context as a proxy for user intent. Older clients that omit `raw_prompt` continue to fall back to `message`.

### VSCodex event and status changes

The incoming WebSocket contract now includes a `routing` event with `process_mode`, `reason`, `client_type`, and `node`. VSCodex renders this event as the initial agent progress state and no longer sets the context panel to `planning` unconditionally. Existing token, status, tool, telemetry, `Ready`, and `done` events remain supported.

### Backend routing changes

- `init_node` stores structured classification metadata in state and telemetry.
- Short requests route directly from `init` to `reason`.
- Tool calls take precedence over the short flag and promote the request to long mode in the returned graph state.
- Clean classified responses without action, file, path, tool, or artifact evidence can end without validation/evaluation/final-report nodes.
- Trading-space routing remains available for long requests, while short requests use the direct conversational path.
- Graph iteration and request-time budgets are configurable and bounded. The current defaults are 80 graph iterations and 300 seconds, clamped to 20-120 iterations and 30-900 seconds.
- Telemetry records process mode, classification reason, node sequence, tool-promotion state, and LLM-call count.

### Validation status and residual gap

The focused routing tests, backend graph/import checks, extension TypeScript compilation, extension tests, and diff checks pass. Full authenticated WebSocket lifecycle integration coverage remains outstanding for routing, token/tool events, telemetry, `Ready`, `done`, and timeout ordering. Pylance may also report `langgraph.graph` as unresolved when the selected interpreter is not the active backend virtual environment; runtime imports and graph compilation pass in the configured environment.

