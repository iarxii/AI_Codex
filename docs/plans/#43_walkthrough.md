# Walkthrough - AI Codex Redeployment & Extension Alignment

Standardized the backend/premium fallback URLs across the web client and VSCode extension submodules to the new Cloud Run URL format (`*-1096425756328.us-central1.run.app`), and successfully compiled/repackaged the extension.

## Changes Made

### Web Client
- Updated `client/src/config.ts` fallback URL to point to `https://aicodex-be-1096425756328.us-central1.run.app`.

### VSCode Extension Submodule (`vscode-extension`)
- Updated the fallback URLs in `src/panels/chatView.html` to point to `https://aicodex-be-1096425756328.us-central1.run.app/api` and `https://aicodex-premium-1096425756328.us-central1.run.app/api`.
- Successfully compiled the extension (`npm run compile`).
- Repackaged the extension into `spirit-bird-codexspaces-1.2.0.vsix` with all runtime dependencies (ONNX runtime / transformers) included.

### Git Commits
- Committed the submodule changes in `vscode-extension`.
- Committed the parent repository changes (including client config and submodule pointer).

## Verification Results
- Cloud Run services verified as active and responding at the new domain structure.
- VSCode extension compiles and packages successfully into the new VSIX.
