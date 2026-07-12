# Client Routing & Tool Logic Separation

The backend agent pipeline has been fully refactored to support client-aware logic, effectively separating tool binding, heuristics, and execution delegation between the Web, VSCodex, and upcoming AIDock/AI_Droid clients.

## What Was Accomplished

### 1. Foundation: Client Context Propagation
- **Web Payload Updated**: Added `client_type: 'web'` to the WebSocket payloads in the Web UI (`client/src/pages/Chat.tsx`).
- **Graph State**: Added `client_type` to `AgentState` in `backend/agent/state.py`.
- **Backend Fallback**: Updated the WebSocket handler (`backend/api/chat.py`) to default to `"web"` if the client forgets to send a `client_type`. *(Note: VSCodex already sends `"vscode"` natively, so it receives IDE tools without issue).*

### 2. Client-Aware Heuristics (`is_short_process`)
The heuristic used to determine whether a message is a "short process" (bypassing the reasoning loop) has been branched in `backend/agent/nodes.py`:
- **VSCodex & AIDock**: Retain the strict `<45 characters` limit with checks for technical action words (e.g., "create", "write").
- **Web**: Web users frequently ask short, substantive questions (e.g., "What is a neural network?"). The length-based fallback was removed for Web, meaning it only short-circuits on explicit greetings and acknowledgments ("Hi", "Thanks").

### 3. Tool Binding Protection
We identified a scenario where the LLM might hallucinate tool calls even for short processes (like "Hi"), causing the graph to erroneously promote the conversation to a long-running process.
- **Fix**: In `reason_node`, if `is_short_process` is True, we now **completely suppress tool binding**. This guarantees the LLM must respond conversationally.
- **Client Capabilities**: `get_agent_tools` in `backend/agent/tools.py` now accepts `client_type` and explicitly strips out `workspace_writer`, `workspace_reader`, and `shell_exec` for the Web client.

### 4. Graph Router Purity & Task Leaks
- **State Mutation Removed**: The `should_continue` routing function in `backend/agent/graph.py` no longer directly mutates `state["is_short_process"]`. Instead, it respects the `is_short_process` flag and immediately routes to `END` without evaluating tool calls.
- **Sleepy-AI-Timer**: We verified that `run_agent_task` in `chat.py` already implements a `finally` block that cancels the `checker_task` memory leak, ensuring UI status correctly resets to `idle`.

### 5. Automated Verification
We rewrote the test suite in `backend/test_short_process_routing.py` to cover the `client_type` variation matrix:
- **Web**: Verified `"Hi"` fast-paths, while `"What is neural network?"` triggers deep reasoning.
- **VSCodex**: Verified `"Hi"` fast-paths, while `"Create a python script"` triggers deep reasoning.
- **Routing**: Verified that short processes route to `END` immediately, completely overriding any stray tool calls.

All tests are passing with a pristine exit code.
