# Goal Description
The agent is currently struggling with coding tasks when using the `workspace_writer` tool over the CloudRun backend. The symptoms (stalling, returning previous messages, hallucinating raw markdown instead of valid tool calls, and writing regressive/truncated code) are classic indicators of context-window exhaustion and tool schema mismatch.

Specifically:
1. **Regressive Code**: The current `workspace_writer` tool forces the model to generate the *entire* contents of a file to update it. For large files (like `ChatViewProvider.ts`), this is prone to truncation, causing regressions.
2. **Hallucinations & Stalling**: When the LLM realizes it needs to rewrite a 2000-line file, it often breaks the JSON schema or defaults to raw markdown (e.g., `[WRITE] Overwriting...` seen in your logs). This causes LangGraph tool parsing to fail, resulting in stalling or loops.

## User Review Required
> [!IMPORTANT]
> The proposed fix requires introducing a new **Targeted File Edit (Patcher)** mechanism to the backend and the VSCode extension. Do you approve adding this capability?

## Proposed Changes

### AI_Codex Backend

#### [NEW] `backend/skills/builtin/workspace_patcher.py`
Create a new skill that allows the agent to update files using Search/Replace blocks or Line-Range replacements, rather than rewriting the whole file.
- The schema will take `filename`, `search_string`, and `replace_string`.

#### [MODIFY] `backend/agent/tools.py`
Register the new `workspace_patcher` skill and wrap it so it gets correctly bound to the LLM.

#### [MODIFY] `backend/agent/nodes.py`
Harden the System Prompt generation. We need to explicitly instruct the model: *"Never output raw code blocks intended to be written to files. You MUST use the `workspace_patcher` tool to modify existing code and the `workspace_writer` tool for brand new files."*

### AI_Codex VSCode Extension

#### [MODIFY] `vscode-extension/src/panels/ChatViewProvider.ts`
1. Update `handleClientToolCall` to recognize the new `workspace_patcher` action.
2. Implement the `executeFilePatch` method to apply targeted text replacements or diffs directly in the user's workspace without destroying the whole file.

## Verification Plan

### Manual Verification
1. I will execute the changes in the source control.
2. You can then test the extension against the modified backend.
3. We will instruct the agent to make a 1-line change to a massive file (like `ChatViewProvider.ts`) and verify that it uses the `workspace_patcher` tool, correctly modifying only the target lines without truncating the rest of the file.
