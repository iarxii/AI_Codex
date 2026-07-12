# Conditional Sequential Thinking Tool Binding

## Goal
Bind the `mcp__reasoning__sequentialthinking` tool dynamically based on our routing heuristics, rather than blindly adding it every time the client provides it. This prevents wasting tokens on short processes and avoids conflicting with native-reasoning LLMs.

## User Review Required
> [!IMPORTANT]
> The MCP tool is provided by the VSCodex client via the scratchpad `mcp_tools` payload. We will add interception logic in the backend graph router (`reason_node`) to gracefully drop the tool under specific conditions.

## Proposed Changes

### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
In `reason_node()`, we will modify the client-side MCP tool binding loop:

1. **Short Process Heuristic**: If `state.get("is_short_process", False)` is True, we will skip binding `mcp__reasoning__sequentialthinking`. (Currently, the graph suppresses all tools on short processes, but filtering it here explicitly reduces the schema payload size and system prompt clutter).
2. **Native Reasoning Check**: If the configured `model` name contains keywords indicating native reasoning capabilities (e.g., `o1`, `o3`, `thinking`), we will skip binding the tool to prevent conflicts with the LLM's built-in Chain-of-Thought.
3. Otherwise, the tool binds normally for standard models (`claude-3.5`, `gpt-4o`, `gemma3`, `llama3`).

```python
    if mcp_tools_list:
        from langchain_core.tools import StructuredTool
        for mcp_t in mcp_tools_list:
            tool_name = mcp_t.get("name")
            
            # Smart Routing Heuristics for Sequential Thinking
            if tool_name == "mcp__reasoning__sequentialthinking":
                # 1. Skip if it's a short/repetitive process
                if state.get("is_short_process", False):
                    continue
                # 2. Skip if the model natively supports reasoning
                if any(kw in model.lower() for kw in ["o1", "o3", "thinking"]):
                    continue

            if any(t.name == tool_name for t in tools):
                continue
            # ... tool wrapper creation ...
```

## Verification Plan
1. Send a short process query ("Hi") -> The tool will not be bound.
2. Send a long process query using `gemini-2.0-flash-thinking` -> The tool will not be bound.
3. Send a long process query using `gemma3` or `claude-3.5-sonnet` -> The tool will bind correctly and enable the sequential thought workflow.
