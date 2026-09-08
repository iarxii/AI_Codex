Searched for files: *
Listed directory AI_Codex
Viewed .gitmodules:1-13
Listed directory client
Listed directory codex_spaces
Searched for "client_type"
Viewed nodes.py:980-1060
Viewed nodes.py:1240-1320
Viewed nodes.py:1190-1245
Viewed chat.py:520-620
Searched for "tool_response"
Viewed chat.py:900-950
Viewed c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\skills\shell_exec.py:2-101
Searched for files: *shell*
Viewed shell_exec.py:1-66
Viewed sandbox.py:1-60
Ran command: `git worktree list`
Searched for "ensureShellSession"
Ran command: `Select-String -Path "C:\AppDev\My_Linkdin\.git\modules\projects\iarxii\AI_Codex\modules\vscode-extension.worktrees\vscodex-backend-loop-fix\src\panels\ChatViewProvider.ts" -Pattern "ensureShellSession|executeCommand|_pendingShellCommand|shellKind"`
Viewed ChatViewProvider.ts:3515-3620
Viewed ChatViewProvider.ts:3621-3785
Ran command: `Select-String -Path "C:\AppDev\My_Linkdin\.git\modules\projects\iarxii\AI_Codex\modules\vscode-extension.worktrees\vscodex-backend-loop-fix\src\panels\ChatViewProvider.ts" -Pattern "handleClientToolCall" -Context 5,20`
Viewed ChatViewProvider.ts:2835-2890
Viewed ChatViewProvider.ts:2891-2920
Viewed graph.py:1-150
Viewed graph.py:151-263
Ran command: `Select-String -Path "c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\agent\nodes.py" -Pattern "def verification_node" -Context 0,40`
Viewed nodes.py:1495-1550
Ran command: `Select-String -Path "c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex\backend\agent\nodes.py" -Pattern "def guard_node" -Context 0,40`
Ran command: `Select-String -Path "backend\agent\*.py","backend\api\*.py" -Pattern "client_delegated_tools|resolve_client_capabilities|client_type|aidock|android"`
Viewed skill_routing.py:1-150
Viewed skill_routing.py:280-330
Viewed tools.py:70-140
Listed directory cli
Ran command: `Select-String -Path "backend\data\profile\*.md","backend\**\*.md" -Pattern "aidock"`
Ran command: `Select-String -Path "backend\**\*.py" -Pattern "aidock"`
Viewed AGENTS.md:90-117
Viewed profile.py:125-165
Ran command: `Select-String -Path "client\src\**\*.ts*","client\src\**\*.js*" -Pattern "tool_response|client_tool_call|tool_execution"`
Ran command: `Select-String -Path "cli\packages\**\*.ts" -Pattern "client_tool_call|tool_response|client_type"`
Ran command: `Select-String -Path "cli\packages\**\*.ts" -Pattern "ws://|http://|WebSocket"`
Viewed README.md:1-60
Ran command: `Get-ChildItem -Path "c:\AppDev\My_Linkdin\projects\iarxii\AI_Codex" -Recurse -Filter "*aidock*" | Select-Object FullName`
Used tool: manage_task

## Comprehensive Validation & Expanded Audit Report

### Executive Summary

The findings in your investigation report are **thoroughly validated** against the active codebases across [`backend`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend) and [`vscode-extension`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension). Every one of the 15 points represents a genuine design friction point or latent failure mode.

Furthermore, deep inspection of the backend prompt profiles, graph logic, and client ecosystem reveals **four critical additional root causes** that compound this behavior:
1. **The PowerShell Cmdlet `$LASTEXITCODE` Bug**: Cmdlets (e.g. `Get-ChildItem`) do not set `$LASTEXITCODE`. The extension parses the empty exit code as `NaN`, outputting `Exit Code: -1` even when commands succeed.
2. **Ignored Working Directory in VS Code**: [`handleClientToolCall`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L2859-L2861) extracts only `command` and `shell`, completely dropping `args.cwd`. [`executeCommand`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3711-L3715) hardcodes execution to the root workspace folder, ignoring subdirectory requests.
3. **Mandatory Looping Prompts in `AGENTS.md`**: Rules 115 and 116 in [`AGENTS.md`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/data/profile/AGENTS.md#L115-L116) explicitly order the agent: *"If a tool call fails or returns an error (e.g. non-zero exit code or stderr), DO NOT stop to ask the user. Instead, analyze the error output, formulate a fix... and call the tool again"*, followed by mandatory verification.
4. **The Broader Client Ecosystem**: Beyond VS Code, the platform defines five client types (`vscode`, `web`, `aidock`, `cli`, and `android`). The current delegation architecture creates sharp asymmetries—`web` has zero client execution capabilities and depends on backend sandboxing, `aidock` shares VS Code's tool list but is missing from prompts and loggers, and `cli` (`pi_cli_aicodex`) lacks formal capability registration.

---

### Part 1: Validation of Report Points 1 – 15

| # | Report Finding | Code Validation & File References | Status |
|---|---|---|---|
| **1** | **Shell selection not end-to-end** | [`ShellExecSkill.execute`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/shell_exec.py#L36-L62) accepts `shell: str = "default"`, but never passes `shell` to [`execute_sandboxed`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/sandbox.py#L28-L60). `sandbox.py` always invokes `asyncio.create_subprocess_shell()`, which defaults to `cmd.exe` via `%COMSPEC%` on Windows. | **Confirmed** |
| **2** | **`default` shell behavior is ambiguous** | [`resolveShellKind`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3762-L3767) maps `"default"` to `"powershell"` on Windows. If the active shell session was previously spawned as `"cmd"`, requesting `"default"` triggers an unexpected shell switch and process restart. | **Confirmed** |
| **3** | **Shell switching orphans pending commands** | In [`executeCommand`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3715-L3723), `await this.ensureShellSession(cwd, shellKind)` is called **before** checking `if (this._pendingShellCommand)`. `ensureShellSession` kills `this._shellProcess` immediately if the shell type changes, aborting in-flight work. | **Confirmed** |
| **4** | **Persistent interactive shell output is noisy** | [`getShellConfig`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3773-L3785) spawns CMD with `/Q /K`, PowerShell with `-NoExit -Command -`, and Bash with `-i`. Prompts, stdin echo, and ANSI escapes pollute `pending.stdout`. Lines [3603–3605](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3603-L3605) only strip the single marker line. | **Confirmed** |
| **5** | **Marker protocol is fragile** | CMD uses `%ERRORLEVEL%`, Bash uses `$?`, and PowerShell uses `$LASTEXITCODE`. Line [3599](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3599) matches `${pending.marker}[: ]\\s*(\\d+)$`. If the exit code is empty, `code` becomes `NaN`, yielding `-1`. | **Confirmed** |
| **6** | **Global `_pendingShellCommand` serializes calls** | Only one slot exists at line [3721](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3721). If an asynchronous or multi-tool turn fires two shell calls, the second immediately rejects with `"Error: A shell command is already running"`. | **Confirmed** |
| **7** | **Successful tool results re-enter model unconditionally** | In [`graph.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/graph.py#L249-L259), `execute_tool` always leads to `verification`, which leads to `guard`, which leads to `reason`. There is no early exit or stop rule for simple idempotent operations like directory listings. | **Confirmed** |
| **8** | **Tool-call fingerprints reset per turn** | In [`guard_node`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L450-L466), history inspection breaks upon encountering the first `HumanMessage`. Consecutive duplicate call tracking is turn-local and resets whenever a new turn starts. | **Confirmed** |
| **9** | **Tool calls are semantically under-specified** | [`ShellExecSkill.parameters`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/shell_exec.py#L15-L34) exposes only `command`, `cwd`, and `shell`. The schema lacks intent classification (read vs write, destructive vs non-destructive, exit-on-error). | **Confirmed** |
| **10** | **Backend and client share identical tool names** | Both declare `shell_exec`, `workspace_reader`, and `workspace_writer`. The model cannot discern from the tool signature alone whether it is targeting the backend sandbox or the client IDE. | **Confirmed** |
| **11** | **Backend and client have separate root directories** | Backend resolves relative to `PROJECT_ROOT` or `WORKSPACES_DIR/<conv_id>/scratch` ([`shell_exec.py:L40-46`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/shell_exec.py#L40-L46)), while VS Code resolves relative to `vscode.workspace.workspaceFolders[0]`. | **Confirmed** |
| **12** | **WebSocket response handling vulnerable to stale messages** | In [`chat.py:L913-919`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py#L913-L919), tool responses are routed purely by `tool_id` against `client_tool_response_queues`. No session epoch or generation ID exists, so reconnects drop responses with `"unknown tool_id"`. | **Confirmed** |
| **13** | **Cancellation does not fully synchronize state** | WebSocket cancellation in [`chat.py:L921-927`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py#L921-L927) cancels asyncio tasks on the backend, while the client extension clears `_pendingShellCommand`. However, lingering sub-processes or late tool completions are not gracefully reconciled. | **Confirmed** |
| **14** | **Unstructured error output** | The client formats responses as a plain string: `Stdout:\n...\nStderr:\n...\nExit Code: ...` ([`ChatViewProvider.ts:L3607`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3607)). The LLM has to parse mixed text to determine failure modes. | **Confirmed** |
| **15** | **Verification node compounds loops** | [`verification_node`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L1501-L1545) automatically injects a `shell_exec` command (`npm run compile` or `python -m py_compile`) whenever `workspace_writer` was used. This synthetic tool call routes back through `execute_tool` -> `guard` -> `reason`. | **Confirmed** |

---

### Part 2: New Discoveries & Hidden Failure Accelerators

```
                       ┌────────────────────────────────────────────────────────┐
                       │                   THE LOOPING SPIRAL                   │
                       └────────────────────────────────────────────────────────┘

    1. Agent writes code / runs command
           │
           ▼
    2. Client runs in interactive PTY
       - Stdin echo & prompts in stdout
       - PowerShell cmdlet does NOT set $LASTEXITCODE
           │
           ▼
    3. Marker parsing fails -> returns "Exit Code: -1"
           │
           ▼
    4. Backend receives "Exit Code: -1" + noisy stdout
           │
           ▼
    5. AGENTS.md Rule 115 ("Autonomous Error Recovery"):
       "DO NOT stop to ask the user. Analyze error output and call the tool again."
           │
           ▼
    6. AGENTS.md Rule 116 ("Autonomous Verification"):
       "Autonomously verify the state via shell_exec before declaring complete."
           │
           ▼
    7. verification_node injects hardcoded "npm run compile" with wrong backend CWD
           │
           ▼
    8. Loop repeats until Graph Recursion Limit or Stuck Guard fires!
```

#### Discovery A: The PowerShell Cmdlet Exit Code Bug Produces Constant `Exit Code: -1`
In [`ChatViewProvider.ts`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3729):
```typescript
commandPayload = `${executableCommand}\r\nWrite-Output "${marker} $LASTEXITCODE"\r\n`
```
- In PowerShell, `$LASTEXITCODE` is **only** populated by external Win32 binaries (`git.exe`, `node.exe`).
- Pure PowerShell cmdlets (`Get-ChildItem`, `Test-Path`, `Get-Content`, `Set-Location`) **do not set `$LASTEXITCODE`**.
- When the command finishes, PowerShell prints:
  ```text
  __SB_CMD_END_1725... 
  ```
  *(with a trailing space and no number!)*
- The regex match [`markerLine.match(new RegExp(`${pending.marker}[: ]\\s*(\\d+)$`))`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L3599) **fails** because there are no trailing digits.
- Line 3601 evaluates `code = NaN`, which line 3607 formats as:
  ```text
  Exit Code: -1
  ```
- **Consequence**: Every single built-in PowerShell command appears to the LLM as an unhandled error (`Exit Code: -1`), even when it succeeded completely!

#### Discovery B: `args.cwd` is Completely Ignored by the VS Code Client
In [`ChatViewProvider.ts:L2859-L2861`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L2859-L2861):
```typescript
} else if (name === "shell_exec") {
    const { command, shell } = args;
    output = await this.executeCommand(command, shell);
}
```
And inside `executeCommand`:
```typescript
const workspaceFolders = vscode.workspace.workspaceFolders;
const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : process.cwd();
await this.ensureShellSession(cwd, shellKind);
```
- `args.cwd` sent by the backend is discarded.
- Furthermore, if `this._shellProcess` is already alive, `ensureShellSession` returns immediately without executing `cd`.
- If the agent ran `cd some_dir` in turn 1, turn 2 remains in `some_dir` regardless of what `args.cwd` specifies.

#### Discovery C: System Prompts Mandate Retrying on Errors
In [`backend/data/profile/AGENTS.md:L115-L116`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/data/profile/AGENTS.md#L115-L116):
> **Autonomous Error Recovery**: If a tool call (such as `shell_exec` or `workspace_writer`) fails or returns an error (e.g., non-zero exit code or stderr), DO NOT stop to ask the user. Instead, analyze the error output, formulate a fix... and call the tool again with the corrected arguments.
> **Autonomous Verification**: After writing a file or executing a command, autonomously verify the state (e.g., read the file back or run a test script via `shell_exec`) before declaring the step or task complete.

Because Discovery A causes PowerShell to emit `Exit Code: -1`, and Discovery B causes wrong directories, the model follows Rule 115 strictly: it refuses to reply to the user, formulates an alternative shell command, and calls it again.

#### Discovery D: Backend Verification Injects Hardcoded Monorepo Paths
In [`backend/agent/nodes.py:L1523-L1524`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L1523-L1524):
```python
if any("vscode-extension" in f for f in files_modified):
    command = "npm run compile"
    cwd = "projects/iarxii/AI_Codex/vscode-extension"
```
This hardcodes a relative path specific to the developer's local backend monorepo root. When delegated to a client whose root is already the extension worktree, this path fails.

---

### Part 3: Client Ecosystem & Delegation Architecture

AICodex supports five distinct client environments. Any changes made to fix VS Code must respect the delegation contract for all clients so none are broken:

```
                            ┌────────────────────────┐
                            │    AICodex Backend     │
                            │  (LangGraph + FastAPI) │
                            └───────────┬────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
   ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
   │  vscode / aidock  │      │        web        │      │    cli (pi_cli)   │
   ├───────────────────┤      ├───────────────────┤      ├───────────────────┤
   │ Local Client Exec │      │ Backend Sandboxed │      │ Direct Local Exec │
   │ - Client FS       │      │ - CloudRun/Docker │      │ - Standalone TUI  │
   │ - Client PTY      │      │ - Scratch Dir     │      │ - Local Node Proc │
   │ - WS Delegation   │      │ - Zero Client Cap │      │ - No WS Del. Yet  │
   └───────────────────┘      └───────────────────┘      └───────────────────┘
```

#### Detailed Client Breakdown

| Client (`client_type`) | Capabilities in [`skill_routing.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/skill_routing.py#L27-L43) | Delegated via WebSocket in [`nodes.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L1021-L1025) | Execution Target | Handling Requirements & Risks |
|---|---|---|---|---|
| **`vscode`** | `workspace.read`, `workspace.write`, `shell.execute`, `codebase.search`, `vscode.webview` | Yes (`workspace_writer`, `workspace_reader`, `shell_exec`, `workspace_patcher`) | Client IDE Workspace & Local Shell | **Must delegate**. Never fall back to backend filesystem. Must honor `cwd` and non-interactive shell execution. |
| **`aidock`** | `workspace.read`, `workspace.write`, `shell.execute`, `codebase.search` | Yes (`workspace_writer`, `workspace_reader`, `shell_exec`, `workspace_patcher`) | Remote Container / Dev Environment | Shares VS Code's delegation model. Must be explicitly included in prompt guidelines and logging. |
| **`web`** | *None* (`frozenset()`) | **No**. Web client has no local disk or shell. | Backend Sandbox ([`execute_sandboxed`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/sandbox.py) or CloudRun) | **Must execute backend-side**. If we require all tools to delegate to client WebSockets, web chat will fail. |
| **`cli`** | *Missing from dictionary* (defaults to empty) | **No** | Local CLI Host Process | Must be added to `CLIENT_CAPABILITIES`. Can run tools locally or communicate via standalone protocol. |
| **`android`** | *None* (`frozenset()`) | **No** | Cloud/Backend Sandbox | Mobile client with no local shell; all executions must be sandboxed on backend. |

---

### Part 4: Recommendations & Remediation Roadmap

#### 1. Adopt Discrete (Non-Interactive) Process Execution in the Extension
Interactive shells (`/K`, `-NoExit`, `-i`) are the root of echo contamination and marker parsing failures.
- For tool execution, execute via `child_process.exec` or `child_process.spawn` with explicit flags (`cmd.exe /D /C "<command>"`, `powershell.exe -NoProfile -NonInteractive -Command "<command>"`, `/bin/bash -c "<command>"`).
- Capture stdout and stderr streams cleanly from OS pipe descriptors.
- Obtain the real process exit code directly from the process `exit`/`close` event—completely eliminating the need for echo markers (`__SB_CMD_END_`).
- Stream the stdout/stderr into the UI pseudoterminal for user visibility, while keeping the tool payload string pristine.

#### 2. Fix PowerShell Marker and Cmdlet Handling (if PTY is retained)
If an interactive session must be preserved for user typing:
- Check `$?` in addition to `$LASTEXITCODE`:
  ```powershell
  $ec = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { [int](-not $?) }
  Write-Output "${marker}:$ec"
  ```
- Make regex robust to empty codes and trailing whitespace:
  ```typescript
  new RegExp(`${pending.marker}[: ]\\s*(-?\\d+)`)
  ```

#### 3. Honor `cwd` in the VS Code Client
In [`handleClientToolCall`](file:///C:/AppDev/My_Linkdin/.git/modules/projects/iarxii/AI_Codex/modules/vscode-extension.worktrees/vscodex-backend-loop-fix/src/panels/ChatViewProvider.ts#L2859):
```typescript
} else if (name === "shell_exec") {
    const { command, shell, cwd } = args;
    output = await this.executeCommand(command, shell, cwd);
}
```
Resolve `cwd` relative to `workspaceFolders[0].uri.fsPath`:
```typescript
const targetCwd = cwd
  ? path.resolve(workspaceFolders[0].uri.fsPath, cwd)
  : workspaceFolders[0].uri.fsPath;
```

#### 4. Pass Shell Selection to Backend Sandbox
In [`ShellExecSkill.execute`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/shell_exec.py#L61):
```python
result = await execute_sandboxed(command, cwd=str(abs_cwd), shell=shell, conversation_id=conversation_id)
```
Update [`execute_sandboxed`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/sandbox.py) to select `powershell.exe -Command`, `cmd.exe /C`, or `bash -c` accordingly.

#### 5. Return Structured Tool Results
Replace plain text outputs with structured JSON payloads between client and backend:
```json
{
  "success": true,
  "exit_code": 0,
  "stdout": "...",
  "stderr": "",
  "cwd": "C:\\workspace",
  "shell": "powershell"
}
```
This enables the backend model to immediately distinguish between a shell syntax error, a missing executable, and a normal non-zero exit code.

#### 6. Soften System Prompt Loop Triggers
Update [`backend/data/profile/AGENTS.md`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/data/profile/AGENTS.md#L115):
- Limit autonomous retries to a maximum of 1 attempt before asking the user or concluding.
- Forbid re-running read/list operations when the previous invocation returned valid files or directory entries.

#### 7. Formalize Multi-Client Capability Matrix
- Register `cli` in [`CLIENT_CAPABILITIES`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/skill_routing.py#L27) and [`SUPPORTED_PLATFORMS`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/skill_routing.py#L12).
- Update [`profile.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/profile.py#L142) and [`nodes.py`](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L1195) to explicitly include `aidock` alongside `vscode`.
- Preserve the explicit boundary ensuring `web` and `android` execute through the backend sandbox, while `vscode` and `aidock` delegate to their respective client environments.