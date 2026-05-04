# Fix Agent Orchestration & Tool Execution (LangGraph)

The issues you noticed with tool calling and the Agent Canvas output are caused by a disconnection between how LangChain `StructuredTool`s are generated, how they are executed, and how the frontend extracts artifacts. 

## Issue Analysis
1. **Tool Execution Failures**: In `backend/agent/nodes.py`, the `execute_tool_node` was bypassing LangChain's tool bindings and calling the bare skill from the `registry`. This caused `workspace_writer` to fail (as it lacked the `conversation_id` argument) and native tools like `codebase_search` to fail completely (since they aren't in the skill registry).
2. **Agent Canvas Sync**: When models successfully generate a tool call for `workspace_writer`, they don't echo the raw `[CANVAS:...]` markdown tags back to the frontend in their conversational reply. Thus, the frontend UI logic wasn't capturing the code to display in the Canvas.

## Proposed Changes

### 1. Backend Orchestration (`backend/agent/nodes.py`)
- Update `execute_tool_node` to accept `config: RunnableConfig` (injected automatically by LangGraph).
- Retrieve the compiled toolset via `get_agent_tools(conversation_id)` instead of the raw `registry`.
- Execute tools using `tool.ainvoke(tool_args)`. This cleanly handles both native tools and skills.

### 2. Frontend Scratchpad Sync (`client/src/pages/Chat.tsx`)
- Enhance the `done` WebSocket event handler. When the agent completes its turn, the frontend will now also extract artifacts directly from any `workspace_writer` tool calls present in the state.
- This ensures the Agent Canvas opens immediately with the correct generated content, bridging the gap between LangGraph tool outputs and the UI.

## Open Questions
- Do you want to enforce tool calling for local models as well, or are you happy keeping the current bypass where local models output `[CANVAS:...]` markdown tags natively? (The current bypass is safer for constrained models like Llama 3 8B, which is what is currently implemented).

Please review this plan. Once approved, I will implement these surgical fixes without performing any destructive refactors.
