# Finalizing Agentic UI Orchestration & Context Integrity

This plan addresses the disconnect observed in agent behavior, tool execution failures (recursion), and UI labeling inconsistencies. It ensures that the specialized AI_Codex persona is correctly preserved across the system.

## User Review Required

> [!IMPORTANT]
> **System Prompt Injection**: We are moving from a static system prompt in the OllamaOpt bridge to a dynamic one managed by the AI_Codex reasoning engine. This ensures the agent always "remembers" its specialized instructions (Canvas Protocol, Work Classification).

> [!NOTE]
> **Recursion Limit**: The limit is being increased to 25 to allow for complex, multi-step agentic reasoning without premature termination.

## Proposed Changes

### Backend: Core Agent & API

#### [MODIFY] [ollamaopt_bridge.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/integrations/ollamaopt_bridge.py)
- Update `build_context_wrapper` to accept an optional `system_prompt` argument.
- Use the passed prompt to update the `ContextBuilder` state for every turn, overwriting the generic default.

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- Pass the dynamically assembled system prompt (from `profile.py`) into the `context_builder.build_context` call.
- Ensure the LLM initialization receives the correct provider and model from the configuration.

#### [MODIFY] [chat.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py)
- Increase `recursion_limit` from 10 to 25 in the graph configuration.
- Inject `provider` and `model` metadata into all WebSocket `token` events (streaming, fallback, and final).

### Frontend: Chat Interface

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- Update the WebSocket message handler to prioritize `provider` and `model` metadata from the backend events.
- Ensure the message label remains "sticky" to the source that generated it, even if the user changes selections mid-stream.

## Verification Plan

### Automated/Manual Verification
1. **Persona Test**: Ask the agent "Who are you and what are your operating protocols?". It should mention **AICodex** and **Work Classification/Canvas Protocol**, not "a helpful assistant".
2. **Recursion Test**: Request a complex task (e.g., "Write a Python timer, save it to the scratchpad, and then write a README for it"). Verify it completes without recursion errors.
3. **UI Label Test**: Switch providers from Groq to Local while the agent is still responding. Verify the "Groq" label stays on the current message.
4. **Canvas Trigger**: Ask "Write a timer script". Verify the Agent Canvas slides open automatically as soon as the `[CANVAS:CODE:python]` tag appears in the stream.
