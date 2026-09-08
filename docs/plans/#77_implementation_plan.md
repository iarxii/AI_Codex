# End-to-End Resolution for Shell Execution, Delegation, and Tool Loop Architecture

Fix the shell mismatch, exit code corruption, path handling, client delegation across all clients, and autonomous loop triggers between the AI_Codex backend and client interfaces.

## User Review Required

> [!IMPORTANT]
> - **Execution Mode for Extension**: We will implement discrete command execution per tool call while maintaining terminal visibility/streaming. This eliminates shell prompt echo, stdin contamination, and brittle marker regexes.
> - **PowerShell Exit Code**: Cmdlets will properly capture success/failure `$?` and `$LASTEXITCODE`.
> - **Client Scope**: All 5 clients (`vscode`, `aidock`, `web`, `cli`, `android`) will have explicit capabilities and routing so no client is broken.

## Proposed Changes

---

### 1. VS Code Client Extension (`ChatViewProvider.ts`)
*Worktree: `C:\AppDev\My_Linkdin\.git\modules\projects\iarxii\AI_Codex\modules\vscode-extension.worktrees\vscodex-backend-loop-fix`*
*Main: `c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\vscode-extension`*

#### [MODIFY] [`ChatViewProvider.ts`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts)
- **Pass `cwd` from `args`**:
  Update `handleClientToolCall` to extract `const { command, shell, cwd } = args;` and forward `cwd` to `executeCommand(command, shell, cwd)`.
- **Resolve `cwd` relative to workspace**:
  Resolve `targetCwd = cwd ? path.resolve(rootFsPath, cwd) : rootFsPath`. Verify directory existence.
- **Check pending command before touching shell session**:
  Check `if (this._pendingShellCommand)` **before** running `ensureShellSession` so an in-flight command is not killed/orphaned.
- **Fix PowerShell Exit Code & Marker Detection**:
  Ensure PowerShell commands report valid exit codes even for cmdlets (`$LASTEXITCODE` or `$?` fallback).
  Update regex to parse exit code even if `$LASTEXITCODE` is null/empty or negative, preventing synthetic `-1` exit codes on success.
- **Clean Output Parsing**:
  Filter out command echo, prompt lines, and marker lines so the LLM receives clean stdout/stderr.
- **Synchronize changes to both the active worktree and main extension working copy**:
  Keep both worktrees in sync.

---

### 2. Backend Skills & Sandbox

#### [MODIFY] [`shell_exec.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/shell_exec.py)
- Forward `shell` argument to `execute_sandboxed(command, cwd=str(abs_cwd), shell=shell, conversation_id=conversation_id)`.

#### [MODIFY] [`sandbox.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/sandbox.py)
- Update `execute_sandboxed` to accept `shell: str = "default"`.
- Launch the requested shell executable:
  - `powershell`: `powershell.exe -NoProfile -NonInteractive -Command "<command>"`
  - `cmd`: `cmd.exe /D /C "<command>"`
  - `bash`: `bash -c "<command>"`
  - `default`: Platform default.

---

### 3. Backend Agent Nodes, Verification, & Capabilities

#### [MODIFY] [`skill_routing.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/skill_routing.py)
- Add `"cli"` to `SUPPORTED_PLATFORMS` and `CLIENT_CAPABILITIES` (with full local capabilities: `workspace.read`, `workspace.write`, `shell.execute`, `codebase.search`).
- Ensure `aidock` and `vscode` remain parity-configured.
- Ensure `web` and `android` remain sandboxed/cloudrun-backed.

#### [MODIFY] [`nodes.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py)
- Update `verification_node`:
  - Do not hardcode developer monorepo relative paths (`projects/iarxii/AI_Codex/vscode-extension`).
  - Resolve verification directory based on the actual modified file paths.
  - Add a maximum verification cycle limit (prevent verification loops).
- In `execute_tool_node`:
  - Enhance client tool error logging to mention `client_type` dynamically instead of hardcoding "VS Code".

#### [MODIFY] [`profile.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/profile.py)
- Update workspace context block to mention all delegated clients (`vscode` and `aidock`).

#### [MODIFY] [`AGENTS.md`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/data/profile/AGENTS.md)
- Soften Rule 115 ("Autonomous Error Recovery") and Rule 116 ("Autonomous Verification"):
  - Cap autonomous retry attempts to 1. If repeated or unresolvable, formulate a clear explanation or question to the user instead of looping.
  - Forbid re-running read/list operations when the previous invocation returned valid entries.
  - Clarify that non-empty directory listings or file reads are terminal successes that do not require re-inspection.

---

## Verification Plan

### Automated Tests
1. Run backend unit tests:
   ```pwsh
   pytest backend/agent/test_short_process_routing.py backend/agent/test_final_report_node.py
   ```
2. Run extension compile check:
   ```pwsh
   npm --prefix "C:\AppDev\My_Linkdin\.git\modules\projects\iarxii\AI_Codex\modules\vscode-extension.worktrees\vscodex-backend-loop-fix" run compile
   ```

### Manual Verification
1. Test shell execution across `cmd`, `powershell`, and `bash` in the VS Code client.
2. Confirm exit codes for PowerShell cmdlets (`Get-ChildItem`) report `Exit Code: 0` without triggering error recovery.
3. Test that directory queries (e.g. "list files") complete in 1 turn without infinite verification or re-reading.
