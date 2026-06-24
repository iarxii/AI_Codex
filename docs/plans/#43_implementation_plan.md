# Implementation Plan - AI Codex Redeployment & Extension Alignment

Align the fallback URLs and configurations across the web client and VSCode extension submodules to the new Cloud Run URL format (`*-1096425756328.us-central1.run.app`), verify the builds, and package the VSCode extension.

## Proposed Changes

### Parent Repository (Web Client)

#### [MODIFY] [config.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/config.ts)
- Update default fallback URL on line 1 to `https://aicodex-be-1096425756328.us-central1.run.app`.

### VSCode Extension Submodule (`vscode-extension`)

#### [MODIFY] [chatView.html](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/vscode-extension/src/panels/chatView.html)
- Update `workspaceBackendUrl` and `workspacePremiumUrl` fallback values on lines 1539-1540 to:
  - `workspaceBackendUrl` = `'https://aicodex-be-1096425756328.us-central1.run.app/api'`
  - `workspacePremiumUrl` = `'https://aicodex-premium-1096425756328.us-central1.run.app/api'`

## Verification Plan

### Automated/Compilation Checks
1. Compile the VSCode extension:
   ```bash
   cd vscode-extension
   npm run compile
   ```
2. Build/Package the extension:
   - Run the packaging command:
     ```bash
     npx @vscode/vsce package --allow-missing-repository
     ```
   - Verify the generated `.vsix` is created successfully and matches the latest version.

### Manual Verification
1. Ensure the web client and backends respond to status checks at `https://aicodex-be-1096425756328.us-central1.run.app/` and `https://aicodex-lab-1096425756328.us-central1.run.app/login`.
