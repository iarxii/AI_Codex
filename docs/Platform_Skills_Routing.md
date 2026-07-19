# Platform-Aware Skills Routing Implementation Plan

## Objective

Refactor the prompt-skill loading model so that mandatory instructions remain small, universal invariants and situational skills are selected only when they match both the user task and the active client platform. This prevents VSCodex workspace behavior from leaking into Web, mobile, or future clients while retaining a shared agent foundation.

The implementation must preserve the existing top-level `skills/mendatory/*.md` and `skills/situational/*.md` layout during migration. The nested `.agents/skills` directories remain packaged source material and are not treated as runtime prompt inputs.

## Current State

`backend/agent/profile.py` currently:

1. Loads every top-level `skills/mendatory/*.md` file into every system prompt.
2. Loads top-level `skills/situational/*.md` files only when their filename is listed in `allowed_skills`.
3. Does not inspect client type, declared capabilities, exclusions, or task-trigger metadata.

The agent already carries `client_type` through state and tool binding. `backend/agent/tools.py` separately filters executable tools by client capability. Prompt skill selection should use the same platform boundary but must not become coupled to a tool's implementation or transport.

## Design Principles

1. **Mandatory means invariant.** A mandatory skill defines behavior that is valid across every supported platform, not a default workflow for one client.
2. **Situational means an overlay.** A situational skill is loaded only when it applies to the task, client, and granted capability set.
3. **Prompt policy and executable tools remain separate.** Skill loading decides instructions; tool binding decides the functions the model may call.
4. **Client capability is explicit.** A skill may request a capability, but the runtime determines whether the current client provides it.
5. **Deny by default for platform-specific skills.** A scoped skill is not injected into an unknown client type.
6. **Compatibility first.** Existing legacy skill files remain loadable until their front matter is migrated.

## Target Skill Contract

Add YAML front matter to every runtime skill file. The loader parses it into a structured `PromptSkillManifest`; the remaining Markdown is injected as the skill body.

```yaml
---
name: defensive-systems-engineer
kind: mandatory
description: Preserves system stability through minimal, contract-safe changes.
platforms: [all]
requires_capabilities: []
excludes_platforms: []
triggers: []
priority: 100
---
```

```yaml
---
name: vscode-workspace-execution
kind: situational
description: Governs tool-first local workspace execution through the VSCodex bridge.
platforms: [vscode]
requires_capabilities: [workspace.read, workspace.write, shell.execute]
excludes_platforms: []
triggers: [workspace-edit, command-execution, codebase-investigation]
priority: 80
---
```

### Manifest Fields

| Field | Purpose |
|---|---|
| `name` | Stable identifier. Must match the filename stem during migration. |
| `kind` | `mandatory` or `situational`; validated against the parent directory. |
| `description` | Concise discovery and audit text. |
| `platforms` | Allowed clients: `all`, `vscode`, `web`, `aidock`, `android`. |
| `requires_capabilities` | Platform features required for the instruction to make sense. |
| `excludes_platforms` | Explicit safety exclusion. Takes precedence over `platforms`. |
| `triggers` | Task labels that can activate a situational skill. Empty for mandatory skills. |
| `priority` | Stable prompt ordering within a skill group. |

Unknown fields must be rejected by validation. A malformed manifest must be logged and skipped, not injected as unstructured prompt text.

## Proposed Skill Taxonomy

### Mandatory Runtime Skills

| Skill | Responsibility | Platform Scope |
|---|---|---|
| `defensive-systems-engineer` | Minimal blast radius, contract awareness, preserve existing behavior, verify changed behavior. | `all` |
| `find-skills` | Discover and recommend skills when the user explicitly seeks an installable or reusable capability. | `all` |

`defensive-systems-engineer` should move from `skills/situational/` to `skills/mendatory/`, but it must be reduced to universal engineering safeguards. Remove any VS Code transport, local filesystem, Canvas, browser, or platform-specific directions from this skill.

### Situational Runtime Skills

| Skill | Trigger Labels | Platform Scope | Required Capabilities |
|---|---|---|---|
| `systematic-debugging` | `debugging`, `root-cause-analysis` | `all` | None |
| `skill-creator` | `skill-authoring`, `skill-packaging` | `all` | None |
| `agent-browser` | `browser-automation`, `web-scraping` | `vscode`, `aidock`, `web` | `browser.automation` |
| `browser-use` | `browser-automation`, `web-scraping` | `vscode`, `aidock`, `web` | `browser.automation` |
| `vscode-workspace-execution` | `workspace-edit`, `command-execution` | `vscode` | `workspace.read`, `workspace.write`, `shell.execute` |
| `vscode-webview-bridge` | `extension-maintenance`, `client-tool-delegation` | `vscode` | `vscode.webview`, `workspace.read` |
| `aidock-workspace-execution` | `workspace-edit`, `command-execution` | `aidock` | `workspace.read`, `workspace.write`, `shell.execute` |
| `web-sandbox-execution` | `workspace-edit`, `command-execution` | `web` | `sandbox.workspace`, `sandbox.shell` |

The last three platform skills should be introduced only when their corresponding executor exists. Their manifests should be present but their capability requirements will prevent accidental loading until the platform is ready.

## Capability Registry

Create one declarative platform capability registry shared by prompt-skill selection and tool binding. It must describe capabilities, not individual implementation details.

```python
CLIENT_CAPABILITIES = {
	 "vscode": {
		  "workspace.read", "workspace.write", "shell.execute",
		  "codebase.search", "vscode.webview"
	 },
	 "aidock": {
		  "workspace.read", "workspace.write", "shell.execute",
		  "codebase.search"
	 },
	 "web": set(),
	 "android": set(),
}
```

The planned premium Web sandbox can augment `web` with `sandbox.workspace` and `sandbox.shell` at session construction. It must not receive VSCodex local-workspace capabilities.

## Implementation Phases

### Phase 1: Skill Model and Compatibility Loader

1. Create `backend/agent/skill_routing.py`.
2. Define immutable models for `PromptSkillManifest` and `LoadedPromptSkill`.
3. Add strict front-matter parsing using the repository's existing YAML dependency; add it to `requirements.txt` only if no supported parser is installed.
4. Treat missing front matter as a legacy manifest:
	- Infer `name` from filename.
	- Infer `kind` from the containing directory.
	- Set `platforms: [all]`.
	- Set `priority: 0`.
5. Return structured diagnostics for missing, invalid, mismatched, and duplicate manifests.

**Acceptance criteria:** Existing skill files render exactly as before when no client or capability restrictions are supplied.

### Phase 2: Platform-Aware Selection

1. Replace `load_mandatory_skills()` with `load_prompt_skills(kind, client_type, capabilities, requested_skills)`.
2. Replace `load_situational_skills(allowed_skills)` with a wrapper around the same selector.
3. Update `build_system_prompt()` to receive `client_type` and `client_capabilities`.
4. Select mandatory skills when their platform and capability requirements match.
5. Select situational skills only when all three conditions hold:
	- The caller requested the skill or requested `all`.
	- The platform matches and is not excluded.
	- All required capabilities exist.
6. Sort selected skills by `priority` then stable `name`.
7. Emit a prompt-safe skill manifest summary, not hidden reasoning, into telemetry/logging for diagnostics.

**Acceptance criteria:** A VSCodex-only skill cannot appear in a `web`, `android`, `None`, or unknown-client prompt.

### Phase 3: Single Capability Source for Prompt and Tools

1. Move the current client capability decisions from `backend/agent/tools.py` into the shared capability registry.
2. Update `get_agent_tools()` to map tools to required capabilities.
3. Keep execution transport selection in `execute_tool_node`; the registry answers only whether a tool is permitted.
4. Pass the same resolved capability set to `build_system_prompt()` and `get_agent_tools()` from the agent execution path.
5. Make unknown client types resolve to the `web` baseline with no privileged capabilities and a warning log.

**Acceptance criteria:** A prompt never instructs the model to use a platform capability for which no executable tool was bound.

### Phase 4: Migrate and Split Existing Skills

1. Move `skills/situational/defensive_systems_engineer.md` to `skills/mendatory/defensive_systems_engineer.md`.
2. Rewrite it as universal engineering policy:
	- Identify the owning code path.
	- Evaluate public contract and blast radius before complex edits.
	- Keep changes focused.
	- Validate the changed behavior.
	- Do not include client, browser, filesystem, Canvas, or transport instructions.
3. Add front matter to `find-skills.SKILL.md` and all top-level situational skill files.
4. Add the VSCodex, AIDock, and Web sandbox overlay skills described above only as concise policy files. Do not duplicate executor implementation details in prompt text.
5. Preserve `.agents/skills` packages unchanged. They are authoring and packaging inputs, not automatically injected runtime skills.

**Acceptance criteria:** Each runtime skill has one responsibility and one declared platform boundary.

### Phase 5: Validation, Observability, and Documentation

1. Add a `validate_prompt_skills()` command or test helper that reports:
	- invalid YAML;
	- unsupported manifest fields;
	- filename/name mismatch;
	- directory/kind mismatch;
	- duplicate names;
	- mandatory skills that require privileged client capabilities;
	- situational skills with no trigger and no explicit selection path.
2. Add a startup validation report at `INFO` level and raise in CI for invalid manifests.
3. Document the authoring contract in `skills/README.md`.
4. Document the supported client/capability matrix in this plan's follow-up walkthrough.

## Code Changes

| File | Change |
|---|---|
| `backend/agent/skill_routing.py` | New prompt-skill manifest models, parser, validator, selector, and client capability registry. |
| `backend/agent/profile.py` | Replace filename-only loading with structured platform-aware selection; pass client context through `build_system_prompt()`. |
| `backend/agent/tools.py` | Consume the shared capability registry for tool eligibility. |
| `backend/agent/nodes.py` | Resolve client type and capabilities once per run; pass them to prompt construction and tool binding. |
| `backend/api/chat.py` | Normalize absent `client_type` to `web` and propagate it into the initial agent state/configuration. |
| `skills/mendatory/defensive_systems_engineer.md` | New universal mandatory policy migrated from the situational directory. |
| `skills/mendatory/find-skills.SKILL.md` | Add runtime skill manifest metadata. |
| `skills/situational/*.SKILL.md` | Add manifests and precise trigger/capability declarations. |
| `skills/README.md` | New authoring and compatibility guidance. |
| `backend/test_prompt_skill_routing.py` | New unit tests for loading, filtering, migration compatibility, and manifest validation. |

## Test Matrix

| Scenario | Client | Requested Skill | Capabilities | Expected Result |
|---|---|---|---|---|
| Universal mandatory policy | `vscode` | None | VSCodex defaults | `defensive-systems-engineer` loads. |
| Universal mandatory policy | `web` | None | None | `defensive-systems-engineer` loads. |
| VSCodex workspace overlay | `vscode` | `vscode-workspace-execution` | Workspace and shell | Overlay loads. |
| VSCodex overlay rejected | `web` | `vscode-workspace-execution` | None | Overlay does not load. |
| Browser automation accepted | `vscode` | `agent-browser` | Browser automation | Skill loads. |
| Browser automation rejected | `android` | `agent-browser` | None | Skill does not load. |
| Legacy file | `web` | `systematic-debugging` | None | File loads through the compatibility manifest. |
| Invalid manifest | Any | Matching name | Any | Skill is skipped; diagnostics identify the file and reason. |
| Unknown client | `unknown` | `vscode-workspace-execution` | None | Overlay does not load; runtime uses unprivileged baseline. |
| Capability parity | `vscode` | Workspace overlay | Workspace and shell | Prompt instruction and matching tools are both available. |

## Verification Plan

1. Run focused routing tests: `pytest backend/test_prompt_skill_routing.py`.
2. Run existing client/tool routing tests: `pytest backend/test_short_process_routing.py`.
3. Add a test that builds prompts for `vscode`, `web`, `aidock`, `android`, and an unknown client, then asserts the injected skill names.
4. Add a test that compares selected capability-gated skill instructions with the names of tools bound for the same client.
5. Run Python compilation for changed backend modules: `python -m py_compile backend/agent/skill_routing.py backend/agent/profile.py backend/agent/tools.py backend/agent/nodes.py backend/api/chat.py`.
6. Manually send an extension workspace-edit request, a Web conversational request, and a Web task that asks for local filesystem access. Verify only the extension gets local workspace policy and tools.

## Rollout and Rollback

Deploy Phase 1 with legacy compatibility enabled and selection diagnostics visible in logs. Migrate individual skill files in Phase 4 after the selection tests pass. Retain the legacy parser for one release cycle, then make front matter mandatory in CI.

If a production issue occurs, revert only `profile.py` to the existing filename-based loader while leaving manifests in place. This restores current prompt behavior without deleting migrated skill content.

## Out of Scope

1. Implementing AIDock's execution transport.
2. Implementing Cloud Run or WebContainer sandboxes.
3. Installing third-party browser automation tools.
4. Converting nested `.agents/skills` packages into direct runtime prompt inputs.
5. Reworking LangGraph routing, short-process heuristics, or agent evaluation loops beyond passing existing client context through skill selection.