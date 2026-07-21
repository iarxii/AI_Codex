# CLI Integration Architectural Plan

This document outlines the architectural boundaries, considerations, and refactoring strategies required to embed the `pi-coding-agent` CLI safely and robustly into the AICodex platform.

## Design Decisions
- **Distribution Format:** The CLI will be compiled into a standalone executable binary using `pkg` (or similar) to remove the Node.js dependency for end-users.
- **State Location:** The primary state location will be a global AppData folder (`~/.aicodex` or equivalent) for persistent storage (logs, configs, history). However, a local workspace folder (`<workspace>/.aicodex`) will also be supported specifically for caching and workspace-aware state management.

## Proposed Architecture & Integration Strategies

### 1. Workspace Context (`process.cwd()`)
The CLI heavily relies on `process.cwd()` to determine the project root for its tool executions (file reading, bash commands, grep, etc.).
**Strategy:**
- The AICodex platform (e.g., `aidock.py` or the VS Code extension) MUST spawn the CLI child process with the `cwd` explicitly set to the user's active project root. 
- **Action Item:** Modify `aidock.py` and the VS Code extension's process spawner to explicitly inject the workspace directory path as the `cwd` parameter, rather than relying on the inherited shell context.

### 2. Global State Isolation & Local Caching
By default, the CLI stores configurations, API keys, and session history in the user's global profile directory (using `os.homedir()`, resolving to `~/.pi`).
**Strategy:**
- **Action Item:** Refactor `packages/coding-agent/src/config.ts` to natively support an `AICODEX_HOME` environment variable for global configuration resolution (pointing to the global AppData folder).
- **Action Item:** Add support for an `AICODEX_LOCAL_CACHE` environment variable, enabling the CLI to read/write workspace-specific cache data to `<workspace>/.aicodex` while falling back to the global state for core configs.

### 3. API Key & Auth Management
The CLI currently prompts the user to log in or falls back to system environment variables (like `OPENAI_API_KEY`).
**Strategy:**
- AICodex should act as the single source of truth for credentials. 
- When spawning the CLI process, AICodex must dynamically inject the active provider's API key into the `env` object of the child process. This ensures a seamless handoff between the extension UI and the background CLI without requiring the user to authenticate twice.

### 4. Standalone Executable Compilation
The CLI relies on local `node_modules` and a Node.js runtime to execute.
**Strategy:**
- **Action Item:** Integrate a compilation step (using `pkg`) into the CLI's build pipeline (`package.json`) to generate a standalone executable binary from the `esbuild` output (`dist/cli.js`). 
- When distributing the extension, ship only the compiled binary for the target OS. This prevents end-users from needing to install Node.js or run `npm install`.

### 5. Managing Upstream Updates
Because this is a fork added as a submodule, you will eventually pull upstream updates from `pi_cli_aicodex`.
**Strategy:**
- Keep custom modifications isolated or well-documented.
- Rely on wrapper scripts (like `aidock.py`) and environment variable overrides to control the CLI's behavior as much as possible, rather than deeply modifying the CLI's core typescript logic. This heavily minimizes the risk of merge conflicts during future upstream pulls.
