# Agent Harness Process Flow

Date: 2026-07-23

## Historical short-process flow

```mermaid
flowchart LR
    A[WebSocket request] --> B[init_node]
    B --> C[planner_node]
    C --> D[guard_node]
    D --> E[reason_node / LLM call]
    E --> F{is_short_process?}
    F -->|true and no tool calls| G[END]
    F -->|false| H[validate]
```

Before remediation, the short flag skipped downstream quality nodes, but planner and guard were still entered.

## Historical long-process flow

```mermaid
flowchart TD
    A[WebSocket request] --> B[init_node]
    B --> C[planner_node]
    C --> D[guard_node]
    D --> E[reason_node / LLM call]
    E --> F{tool calls?}
    F -->|yes| G[execute_tool]
    G --> H[verification]
    H --> I[guard]
    I --> E
    F -->|no| J[validate]
    J --> K[evaluate_turn / LLM call]
    K --> L{goal achieved?}
    L -->|yes| M[final_report / LLM call]
    M --> N[END]
    L -->|no| I
```

## Implemented optimized flow

```mermaid
flowchart TD
    A[WebSocket request] --> B[init_node]
    B --> C{raw prompt classification}
    C -->|short| D[reason_node with tools suppressed]
    D --> E{tool calls?}
    E -->|no| F[END]
    E -->|yes| G[Promote to long mode]
    C -->|long| H[planner_node]
    H --> I[guard_node]
    I --> J[reason_node]
    G --> K[execute_tool]
    J --> L{tool calls?}
    L -->|yes| K
    L -->|no, clean answer| F
    K --> M[verification]
    M --> N{more work?}
    N -->|yes| I
    N -->|no| O[evaluate/final report when justified]
    O --> F
```

For VSCodex, the request now carries `raw_prompt` separately from enriched `message` context. The classifier uses only `raw_prompt`; workspace context, attachments, retrieval data, and MCP tools remain available to the reasoning path.

## Tool-call promotion and safety behavior

```mermaid
sequenceDiagram
    participant R as Router
    participant L as Reasoning model
    participant T as Tool executor
    R->>L: Generate response
    L-->>R: Response with or without tool calls
    alt Tool calls present
        R->>R: Set process mode to long
        R->>T: Execute tools
    else No tool calls and short mode
        R->>R: End after response
    else No tool calls and long mode
        R->>R: Validate or evaluate only when required
    end
```

## WebSocket event lifecycle

```mermaid
sequenceDiagram
    participant V as VSCodex
    participant B as Backend
    participant G as Graph
    V->>B: request(raw_prompt, context)
    B->>G: init state
    G-->>B: routing(mode, reason)
    B-->>V: routing event
    G-->>B: status/token/tool events
    B-->>V: status/token/tool events
    G-->>B: final state
    B-->>V: telemetry
    B-->>V: Ready status
    B-->>V: done
```

The implemented VSCodex request/event contract is:

```mermaid
sequenceDiagram
    participant V as VSCodex
    participant B as Backend
    participant G as Graph
    V->>B: request(raw_prompt, message, context, scratchpad)
    B->>G: init state with raw_prompt
    G-->>B: classification metadata
    B-->>V: routing(process_mode, reason, client_type, node)
    G-->>B: status(node)
    B-->>V: status(node)
    G-->>B: token/tool events
    B-->>V: token/tool events
    G-->>B: final state and telemetry
    B-->>V: telemetry(node_sequence, llm_call_count, tool_promotion)
    B-->>V: status(Ready, idle)
    B-->>V: done
```

The remaining verification work is a deterministic authenticated WebSocket test for this event order and for timeout/error terminal behavior.

