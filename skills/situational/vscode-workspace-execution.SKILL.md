---
name: vscode-workspace-execution
kind: situational
description: Governs local workspace operations delegated through the VSCodex extension host.
platforms: [vscode]
requires_capabilities: [workspace.read, workspace.write, shell.execute]
excludes_platforms: []
triggers: [workspace-edit, command-execution, codebase-investigation]
priority: 80
---

# VSCodex Workspace Execution

For filesystem changes and command execution in VSCodex, use the bound workspace and shell tools. Tool calls perform physical operations in the active local workspace; rendered code or explanatory output does not.

Inspect the relevant workspace context before modifying existing files. Use the patch tool for localized edits and the writer tool only to create a new file. Report the completed action only after the delegated tool result is returned. Keep shell commands scoped to the active workspace and validate the requested behavior after a substantive change.