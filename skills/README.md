# AICodex Prompt-Based Skills Guide

This directory contains modular prompt instructions (skills) loaded dynamically into the agent's system prompt depending on the client platform and the granted capabilities.

## Structure

*   `mendatory/` (historically `mendatory/` due to repository conventions) — universal invariants loaded for every matching client session.
*   `situational/` — situational overlays loaded only when explicitly requested/triggered by the agent task profile.

## The YAML Manifest Contract

Every runtime skill file (`*.md` or `*.SKILL.md`) should begin with a YAML front-matter block enclosed by `---` delimiters. Files without front matter are parsed under legacy rules (assumed platform: `[all]`, kind: folder default, priority: `0`, manifest_version: `1`).

### Example Manifest

```yaml
---
name: vscode-workspace-execution
kind: situational
description: Governs local workspace operations delegated through the VSCodex extension host.
platforms: [vscode]
requires_capabilities: [workspace.read, workspace.write, shell.execute]
excludes_platforms: []
triggers: [workspace-edit, command-execution, codebase-investigation]
priority: 80
manifest_version: 1
---

# VSCodex Workspace Execution
Body content of the prompt follows...
```

### Manifest Fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique identifier. Must match the filename stem (excluding `.SKILL` or `.md`). |
| `kind` | string | Either `mandatory` or `situational`. Must match the parent directory name. |
| `description` | string | Short description explaining what this skill covers. |
| `platforms` | list of strings | Target platforms. Allowed values: `all`, `vscode`, `web`, `aidock`, `android`. |
| `requires_capabilities` | list of strings | Capabilities that must be granted to the client session for this skill to load. |
| `excludes_platforms` | list of strings | Explicitly excludes these platforms (precedes `platforms` matches). |
| `triggers` | list of strings | Tags/topics that trigger this situational skill. Empty for mandatory. |
| `priority` | integer | Priority of the prompt snippet (higher priorities are loaded first). Default is `0`. |
| `manifest_version` | integer | Schema version. Current version is `1`. |

## Capabilities Reference

Standard capabilities supported by the AICodex execution nodes:

*   `workspace.read` — View files and directories.
*   `workspace.write` — Write or patch files.
*   `shell.execute` — Run commands in local terminal/sandbox.
*   `codebase.search` — Access codebase index/retriever.
*   `vscode.webview` — View HTML/webviews inside VS Code.
*   `browser.automation` — Access browser control tools.

## Validation

You can validate all skills by running the validator from the repository root:

```sh
python backend/agent/skill_routing.py
```

This checks for:
1. Invalid YAML front matter or unknown properties.
2. Filename stem and `name` manifest property mismatch.
3. Folder type and `kind` manifest property mismatch.
4. Duplicate skill names.
5. Mandatory skills that incorrectly require privileged capabilities.
6. Situational skills missing triggers.
