# Platform Skills Routing — Refactor Validation & Grade

## Executive Summary

The staged changeset (~12,700 insertions across 70 files) introduces a **platform-aware prompt-skill routing system** that replaces naive filename-based loading with structured YAML-manifest–driven selection, gated by client type and capability sets. The plan document (`Platform_Skills_Routing.md`) is thorough and the implementation delivers on the critical Phase 1–3 contracts.

**Overall Grade: A−** (Strong execution with minor gaps)

---

## 1. Document Quality — `Platform_Skills_Routing.md`

| Criterion | Score | Notes |
|---|---|---|
| Clarity of objective | ★★★★★ | Opening paragraph precisely scopes the problem and non-goal (no VSCodex leakage). |
| Design principles | ★★★★★ | Six crisp, testable principles. "Deny by default" is correctly positioned. |
| Manifest contract | ★★★★☆ | Well-specified. Minor gap: no versioning field for future schema evolution. |
| Phase breakdown | ★★★★★ | Five phases with acceptance criteria per phase — production-grade planning. |
| Test matrix | ★★★★☆ | 10 scenarios covering the critical paths. Missing: multi-capability intersection test. |
| Rollback strategy | ★★★★★ | Single-file revert path (`profile.py`) is elegant and practical. |
| Out of scope | ★★★★★ | Properly fences AIDock, sandboxes, and LangGraph internals. |

> [!TIP]
> Consider adding a `manifest_version: 1` field to the contract now — it costs nothing and avoids a breaking migration later when fields inevitably evolve.

---

## 2. Plan → Code Alignment

### Phase 1: Skill Model and Compatibility Loader ✅ Complete

| Plan Requirement | Code Location | Status |
|---|---|---|
| Create `skill_routing.py` | [skill_routing.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/skill_routing.py) | ✅ |
| `PromptSkillManifest` (immutable) | `@dataclass(frozen=True)` L45-54 | ✅ |
| `LoadedPromptSkill` (immutable) | `@dataclass(frozen=True)` L57-62 | ✅ |
| Strict YAML parsing with unknown-field rejection | `_parse_manifest()` L108-110 | ✅ |
| Legacy fallback (missing front matter) | `_parse_manifest()` L90-96 | ✅ |
| Structured diagnostics | `SkillDiagnostic` dataclass + collection in `load_prompt_skills()` | ✅ |
| Backward compat: existing files render as before | Legacy manifest with `platforms: [all]`, `priority: 0` | ✅ |

### Phase 2: Platform-Aware Selection ✅ Complete

| Plan Requirement | Code Location | Status |
|---|---|---|
| Replace `load_mandatory_skills()` | [profile.py:59-63](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/profile.py#L59-L63) — wrapper around `load_prompt_skill_block()` | ✅ |
| Replace `load_situational_skills()` | [profile.py:66-71](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/profile.py#L66-L71) — same unified pipeline | ✅ |
| `build_system_prompt()` receives `client_type` + `client_capabilities` | [profile.py:82-88](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/profile.py#L82-L88) | ✅ |
| Mandatory: platform + capability match | `select_prompt_skills()` L193-202 | ✅ |
| Situational: requested + platform + capability | `select_prompt_skills()` L203-204 | ✅ |
| Sort by priority desc, name asc | L207 `sorted(..., key=lambda: (-priority, name))` | ✅ |
| VSCodex-only skill blocked for `web`/`android`/unknown | Platform check + excludes check | ✅ |

### Phase 3: Single Capability Source ✅ Complete

| Plan Requirement | Code Location | Status |
|---|---|---|
| `CLIENT_CAPABILITIES` registry in `skill_routing.py` | L26-42 | ✅ |
| `resolve_client_capabilities()` used by both prompt and tools | [skill_routing.py:71-80](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/skill_routing.py#L71-L80) | ✅ |
| `tools.py` imports `resolve_client_capabilities` from registry | [tools.py:6](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/tools.py#L6), [tools.py:52](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/tools.py#L52) | ✅ |
| `nodes.py` resolves capabilities once, passes to both prompt + tools | [nodes.py:569-580](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L569-L580), [nodes.py:664-670](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#L664-L670) | ✅ |
| Unknown client → `web` baseline with no privileges | `resolve_client_capabilities()` L76-77 | ✅ |

### Phase 4: Migrate and Split Existing Skills ✅ Complete

| Plan Requirement | Status |
|---|---|
| `defensive_systems_engineer.md` moved to `mendatory/` with front matter | ✅ Universal policy, no platform-specific language |
| `find-skills.SKILL.md` in `mendatory/` with front matter | ✅ |
| All situational skills have YAML manifests | ✅ All 5 verified: `systematic-debugging`, `skill-creator`, `agent-browser`, `browser-use`, `vscode-workspace-execution` |
| VSCode overlay scoped to `[vscode]` with capability requirements | ✅ `platforms: [vscode]`, `requires_capabilities: [workspace.read, workspace.write, shell.execute]` |
| `.agents/skills` packages preserved unchanged | ✅ Packaged as bundled source, not runtime inputs |

### Phase 5: Validation, Observability, Documentation ⚠️ Partial

| Plan Requirement | Status | Detail |
|---|---|---|
| `validate_prompt_skills()` command/test | ⚠️ Partial | `test_prompt_skill_routing.py` exists (85 lines) but not yet a standalone CLI validator |
| Startup validation report at INFO | ✅ | `profile.py` logs diagnostics per skill at WARNING, selected skills at INFO |
| `skills/README.md` authoring doc | ❌ Missing | Plan specifies it; not in staged changes |
| Client/capability matrix walkthrough doc | ❌ Missing | Plan defers to "follow-up walkthrough" |

---

## 3. Code Quality Assessment

### Strengths

| Aspect | Assessment |
|---|---|
| **Immutability** | `frozen=True` dataclasses prevent mutation of loaded manifests — excellent safety |
| **Separation of concerns** | Parsing, selection, formatting, and capability resolution are cleanly separated functions |
| **Type narrowing** | `_as_string_tuple()` validates list items individually — prevents silent type coercion |
| **Error containment** | Bad manifests are caught, logged as diagnostics, and skipped — never injected as raw text |
| **Deduplication** | `names: set[str]` in loader prevents duplicate skill injection |
| **Sorting stability** | `(-priority, name)` gives deterministic prompt ordering across runs |
| **Registry sharing** | `resolve_client_capabilities()` is the single source of truth for both prompt and tool paths |

### Issues Found

| Severity | File | Issue |
|---|---|---|
| 🟡 Low | `skill_routing.py:90` | Front-matter delimiter check uses `\n---` but files have `\r\n` line endings (Windows). The `text.startswith("---\n")` check will fail on `\r\n` files unless Python opens with universal newlines. Since `read_text(encoding="utf-8")` uses universal newlines by default, this is safe in practice, but the closing delimiter search `\n---` at L98 should also handle `\r\n---`. |
| 🟡 Low | `skill_routing.py:157` | Directory name hardcoded as `"mendatory"` — this is a known repo-level typo (`mandatory` → `mendatory`). The mapping `kind == "mandatory" → dir "mendatory"` is correct for compatibility but should be documented. |
| 🟡 Low | `profile.py:7-11` | Importing three symbols from `skill_routing` but `resolve_client_capabilities` is not imported here — it's imported separately in `nodes.py`. This is fine but could be consolidated. |
| 🟢 Info | `test_prompt_skill_routing.py` | 85 lines is a good start but lacks negative-path tests for: `\r\n` line endings, non-UTF-8 files, extremely long front matter, and concurrent loading. |
| 🟢 Info | `nodes.py:570` | `resolve_client_capabilities` is imported inline (`from backend.agent.skill_routing import ...`) inside `reason_node`. This works but is inconsistent with the top-of-file import at `tools.py:6`. Consider moving to module-level. |

---

## 4. Completeness Scorecard

| Deliverable | Plan Says | Staged | Grade |
|---|---|---|---|
| `skill_routing.py` — models, parser, selector, registry | New | ✅ 216 lines | A |
| `profile.py` — platform-aware prompt construction | Modify | ✅ Refactored | A |
| `tools.py` — shared capability registry | Modify | ✅ `resolve_client_capabilities` consumed | A |
| `nodes.py` — resolve once, pass everywhere | Modify | ✅ Single resolution point | A |
| `chat.py` — normalize `client_type` | Modify | ✅ Defaults to `"web"` | A |
| `defensive_systems_engineer.md` — universal mandatory | Migrate | ✅ Clean, no platform specifics | A |
| `find-skills.SKILL.md` — mandatory manifest | Add metadata | ✅ | A |
| `situational/*.SKILL.md` — all manifested | Add metadata | ✅ 5/5 have front matter | A |
| `test_prompt_skill_routing.py` — unit tests | New | ✅ 85 lines | B+ |
| `skills/README.md` — authoring guide | New | ❌ Not staged | Incomplete |
| Startup validation CLI | New | ⚠️ Partial (tests only) | B |

---

## 5. Risk Assessment

| Risk | Mitigation in Place | Residual |
|---|---|---|
| Breaking existing prompts | Legacy fallback parser (no front matter → inferred manifest) | 🟢 Low |
| VSCodex leaking to Web | Platform check + `excludes_platforms` + deny-by-default for unknown clients | 🟢 Low |
| Prompt/tool capability mismatch | Single `resolve_client_capabilities()` source shared by both paths | 🟢 Low |
| Windows `\r\n` parsing | Python `read_text()` universal newlines handle this, but closing delimiter search is fragile | 🟡 Low–Medium |
| Rollback complexity | Single-file revert (`profile.py`) restores old behavior | 🟢 Low |
| Missing documentation | `skills/README.md` not shipped — new contributors won't know the contract | 🟡 Medium |

---

## 6. Final Grade

```
┌──────────────────────────────────┬───────┐
│ Category                         │ Grade │
├──────────────────────────────────┼───────┤
│ Document Quality                 │   A   │
│ Plan → Code Alignment            │  A−   │
│ Code Quality & Safety            │   A   │
│ Test Coverage                    │  B+   │
│ Completeness (vs. plan)          │  B+   │
│ Risk & Rollback Strategy         │   A   │
├──────────────────────────────────┼───────┤
│ OVERALL                          │  A−   │
└──────────────────────────────────┴───────┘
```

### What Earns the A−

1. **The core contract is delivered.** Phases 1–4 are fully implemented and the code matches the plan precisely.
2. **Safety-first design.** Deny-by-default, immutable data models, explicit error containment, and single capability source.
3. **Backward compatibility preserved.** Legacy skills load identically without front matter.
4. **Rollback is trivial.** One file revert restores the old path.

### What Prevents the Full A

1. **`skills/README.md` is missing.** The plan explicitly calls for it; it's not staged.
2. **Test file is thin.** 85 lines covers happy paths but lacks edge-case and negative-path coverage.
3. **No standalone validation CLI.** Plan Phase 5 calls for a `validate_prompt_skills()` command — only test coverage exists.

---

## 7. Recommended Next Actions

- [ ] Create `skills/README.md` documenting the manifest contract, field reference, and authoring workflow
- [ ] Add edge-case tests: malformed YAML, `\r\n` line endings, duplicate names, unknown fields, empty body
- [ ] Extract `validate_prompt_skills()` as a CLI entry point (e.g., `python -m backend.agent.skill_routing --validate`)
- [ ] Add `manifest_version: 1` to the contract for future schema evolution
- [ ] Move `from backend.agent.skill_routing import resolve_client_capabilities` to top-level in `nodes.py`
