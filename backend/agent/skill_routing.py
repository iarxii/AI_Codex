"""Selection and validation for prompt-based runtime skills."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import yaml


SUPPORTED_PLATFORMS = frozenset({"all", "vscode", "web", "aidock", "android"})
VALID_KINDS = frozenset({"mandatory", "situational"})
MANIFEST_FIELDS = frozenset({
    "name",
    "kind",
    "description",
    "platforms",
    "requires_capabilities",
    "excludes_platforms",
    "triggers",
    "priority",
    "manifest_version",
})


CLIENT_CAPABILITIES = {
    "vscode": frozenset({
        "workspace.read",
        "workspace.write",
        "shell.execute",
        "codebase.search",
        "vscode.webview",
    }),
    "aidock": frozenset({
        "workspace.read",
        "workspace.write",
        "shell.execute",
        "codebase.search",
    }),
    "web": frozenset(),
    "android": frozenset(),
}


@dataclass(frozen=True)
class PromptSkillManifest:
    name: str
    kind: str
    description: str = ""
    platforms: tuple[str, ...] = ("all",)
    requires_capabilities: tuple[str, ...] = ()
    excludes_platforms: tuple[str, ...] = ()
    triggers: tuple[str, ...] = ()
    priority: int = 0
    manifest_version: int = 1


@dataclass(frozen=True)
class LoadedPromptSkill:
    manifest: PromptSkillManifest
    body: str
    source_path: Path
    legacy: bool = False


@dataclass(frozen=True)
class SkillDiagnostic:
    source_path: Path
    message: str


def resolve_client_capabilities(
    client_type: Optional[str],
    additional_capabilities: Optional[Iterable[str]] = None,
) -> frozenset[str]:
    """Resolve an untrusted client identifier to an unprivileged baseline."""
    normalized_client = (client_type or "web").lower()
    capabilities = set(CLIENT_CAPABILITIES.get(normalized_client, CLIENT_CAPABILITIES["web"]))
    if additional_capabilities:
        capabilities.update(additional_capabilities)
    return frozenset(capabilities)


def _as_string_tuple(value: object, field_name: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
        raise ValueError(f"'{field_name}' must be a list of non-empty strings")
    return tuple(value)


def _parse_manifest(path: Path, text: str, kind: str) -> LoadedPromptSkill:
    # Normalize line endings to LF to prevent parser issues with CRLF on Windows
    text = text.replace("\r\n", "\n")

    if not text.startswith("---\n"):
        return LoadedPromptSkill(
            manifest=PromptSkillManifest(name=path.stem, kind=kind),
            body=text,
            source_path=path,
            legacy=True,
        )

    closing_delimiter = text.find("\n---", 4)
    if closing_delimiter == -1:
        raise ValueError("front matter is missing its closing delimiter")

    front_matter = text[4:closing_delimiter]
    body = text[closing_delimiter + 4:].lstrip("\n")
    raw_manifest = yaml.safe_load(front_matter)
    if not isinstance(raw_manifest, dict):
        raise ValueError("front matter must contain a YAML object")

    unknown_fields = set(raw_manifest) - MANIFEST_FIELDS
    if unknown_fields:
        raise ValueError(f"unsupported manifest fields: {', '.join(sorted(unknown_fields))}")

    name = raw_manifest.get("name")
    manifest_kind = raw_manifest.get("kind")
    if not isinstance(name, str) or not name:
        raise ValueError("'name' must be a non-empty string")
    if manifest_kind not in VALID_KINDS:
        raise ValueError("'kind' must be 'mandatory' or 'situational'")
    if manifest_kind != kind:
        raise ValueError(f"manifest kind '{manifest_kind}' does not match '{kind}' directory")

    platforms = _as_string_tuple(raw_manifest.get("platforms", ["all"]), "platforms")
    excludes_platforms = _as_string_tuple(raw_manifest.get("excludes_platforms", []), "excludes_platforms")
    unsupported_platforms = (set(platforms) | set(excludes_platforms)) - SUPPORTED_PLATFORMS
    if unsupported_platforms:
        raise ValueError(f"unsupported platforms: {', '.join(sorted(unsupported_platforms))}")

    description = raw_manifest.get("description", "")
    if not isinstance(description, str):
        raise ValueError("'description' must be a string")
    priority = raw_manifest.get("priority", 0)
    if not isinstance(priority, int):
        raise ValueError("'priority' must be an integer")
    manifest_version = raw_manifest.get("manifest_version", 1)
    if not isinstance(manifest_version, int):
        raise ValueError("'manifest_version' must be an integer")

    return LoadedPromptSkill(
        manifest=PromptSkillManifest(
            name=name,
            kind=manifest_kind,
            description=description,
            platforms=platforms,
            requires_capabilities=_as_string_tuple(
                raw_manifest.get("requires_capabilities", []), "requires_capabilities"
            ),
            excludes_platforms=excludes_platforms,
            triggers=_as_string_tuple(raw_manifest.get("triggers", []), "triggers"),
            priority=priority,
            manifest_version=manifest_version,
        ),
        body=body,
        source_path=path,
    )


def load_prompt_skills(skills_dir: Path, kind: str) -> tuple[list[LoadedPromptSkill], list[SkillDiagnostic]]:
    """Load one runtime skill directory without allowing bad files into prompts."""
    if kind not in VALID_KINDS:
        raise ValueError(f"Unsupported prompt skill kind: {kind}")

    directory = skills_dir / ("mendatory" if kind == "mandatory" else "situational")
    if not directory.exists():
        return [], []

    skills: list[LoadedPromptSkill] = []
    diagnostics: list[SkillDiagnostic] = []
    names: set[str] = set()
    for path in sorted(directory.glob("*.md")):
        try:
            skill = _parse_manifest(path, path.read_text(encoding="utf-8"), kind)
            if skill.manifest.name in names:
                raise ValueError(f"duplicate skill name '{skill.manifest.name}'")
            names.add(skill.manifest.name)
            skills.append(skill)
        except (OSError, ValueError, yaml.YAMLError) as error:
            diagnostics.append(SkillDiagnostic(path, str(error)))

    return skills, diagnostics


def select_prompt_skills(
    skills: Iterable[LoadedPromptSkill],
    kind: str,
    client_type: Optional[str],
    capabilities: Optional[Iterable[str]] = None,
    requested_skills: Optional[Iterable[str]] = None,
) -> list[LoadedPromptSkill]:
    """Select skills that match the requested task, platform, and capabilities."""
    if kind not in VALID_KINDS:
        raise ValueError(f"Unsupported prompt skill kind: {kind}")

    normalized_client = (client_type or "web").lower()
    resolved_capabilities = resolve_client_capabilities(normalized_client, capabilities)
    requested = set(requested_skills or ())
    selected: list[LoadedPromptSkill] = []

    for skill in skills:
        manifest = skill.manifest
        if manifest.kind != kind:
            continue
        if normalized_client in manifest.excludes_platforms:
            continue
        if "all" not in manifest.platforms and normalized_client not in manifest.platforms:
            continue
        if not set(manifest.requires_capabilities).issubset(resolved_capabilities):
            continue
        if kind == "situational" and (not requested or "all" not in requested and manifest.name not in requested):
            continue
        selected.append(skill)

    return sorted(selected, key=lambda skill: (-skill.manifest.priority, skill.manifest.name))


def format_prompt_skills(skills: Iterable[LoadedPromptSkill], label: str) -> str:
    """Render selected skill bodies in a stable, readable prompt block."""
    return "\n".join(
        f"\n--- {label}: {skill.manifest.name.upper()} ---\n{skill.body.strip()}"
        for skill in skills
        if skill.body.strip()
    )


def validate_prompt_skills(skills_dir: Path) -> list[SkillDiagnostic]:
    """Validate all runtime skills in mandatory and situational directories and return errors."""
    errors: list[SkillDiagnostic] = []
    
    for kind in VALID_KINDS:
        _, diagnostics = load_prompt_skills(skills_dir, kind)
        errors.extend(diagnostics)
        
        # Additional validations beyond raw parsing
        loaded_skills, _ = load_prompt_skills(skills_dir, kind)
        for skill in loaded_skills:
            manifest = skill.manifest
            
            # 1. Filename stem matches manifest name (unless legacy)
            if not skill.legacy:
                expected_name = skill.source_path.stem
                # Filename stem can end in .SKILL if it's named name.SKILL.md
                stem_clean = expected_name.replace(".SKILL", "")
                if manifest.name != stem_clean:
                    errors.append(SkillDiagnostic(
                        skill.source_path,
                        f"manifest name '{manifest.name}' does not match filename stem '{stem_clean}'"
                    ))
            
            # 2. Mandatory skills must not require privileged capabilities
            if kind == "mandatory" and manifest.requires_capabilities:
                errors.append(SkillDiagnostic(
                    skill.source_path,
                    f"mandatory skill requires privileged capabilities: {', '.join(manifest.requires_capabilities)}"
                ))

            # 3. Situational skills should have triggers or be selected by path
            if kind == "situational" and not manifest.triggers:
                errors.append(SkillDiagnostic(
                    skill.source_path,
                    "situational skill is missing trigger tags"
                ))

    return errors


if __name__ == "__main__":
    import sys
    # Default search relative to root
    root_skills = Path(__file__).resolve().parent.parent.parent / "skills"
    print(f"Running validator on: {root_skills}")
    validation_errors = validate_prompt_skills(root_skills)
    if validation_errors:
        print(f"Validation FAILED with {len(validation_errors)} error(s):")
        for err in validation_errors:
            print(f"  [{err.source_path.name}]: {err.message}")
        sys.exit(1)
    else:
        print("Validation PASSED successfully.")
        sys.exit(0)