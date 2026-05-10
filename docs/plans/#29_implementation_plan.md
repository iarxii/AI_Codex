# Implementation Plan - Robust Tool Calling Fallback

Handle tool-calling failures for models that do not support it (e.g., DeepSeek-R1 via Ollama) by implementing a pre-check and a graceful fallback mechanism.

## User Review Required

> [!IMPORTANT]
> The solution implements a "retry without tools" mechanism if the model provider returns a specific error indicating that the model does not support tools. This ensures that models like `deepseek-r1:7b` can still be used for conversation even if they cannot use tools.

## Proposed Changes

### Backend Utilities

#### [MODIFY] [telemetry.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/utils/telemetry.py)
- Expand `get_model_capabilities` to include a more comprehensive list of tool-capable models.
- Add a list of known tool-incapable models (like `deepseek-r1`) to proactively disable tool binding.

### Agent Logic

#### [MODIFY] [nodes.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- Update `reason_node` to check for tool support before binding.
- Implement a try-except block around the LLM invocation to catch "does not support tools" errors and retry without tools.
- Ensure that if tools are disabled, the system prompt or message history is not negatively impacted (the model will just chat).

## Verification Plan

### Automated Tests
- I will simulate a "no tool support" response or use a model known to fail (like `deepseek-r1`) if available in the test environment.
- Verify that the error is caught and the model still provides a response.

### Manual Verification
- The user can select `deepseek-r1:7b` in the UI and verify that it no longer returns a 400 error but instead replies normally.
