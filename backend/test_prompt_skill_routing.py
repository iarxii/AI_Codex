import tempfile
import unittest
from pathlib import Path

from backend.agent.skill_routing import (
    load_prompt_skills,
    select_prompt_skills,
    validate_prompt_skills,
    _parse_manifest,
)


class PromptSkillRoutingTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.skills_directory = Path(self.temporary_directory.name)
        (self.skills_directory / "mendatory").mkdir()
        (self.skills_directory / "situational").mkdir()

    def tearDown(self):
        self.temporary_directory.cleanup()

    def write_skill(self, kind: str, filename: str, content: str):
        (self.skills_directory / kind / filename).write_text(content, encoding="utf-8")

    def test_legacy_mandatory_skill_is_selected_for_all_clients(self):
        self.write_skill("mendatory", "legacy.md", "Always preserve contracts.")

        skills, diagnostics = load_prompt_skills(self.skills_directory, "mandatory")
        selected = select_prompt_skills(skills, "mandatory", "android")

        self.assertEqual([], diagnostics)
        self.assertEqual(["legacy"], [skill.manifest.name for skill in selected])
        self.assertTrue(selected[0].legacy)

    def test_platform_and_capability_requirements_gate_situational_skills(self):
        self.write_skill(
            "situational",
            "workspace.md",
            """---
name: vscode-workspace-execution
kind: situational
platforms: [vscode]
requires_capabilities: [workspace.read, workspace.write]
priority: 80
manifest_version: 1
---
Use the local workspace executor.
""",
        )
        skills, diagnostics = load_prompt_skills(self.skills_directory, "situational")

        vscode_selected = select_prompt_skills(
            skills,
            "situational",
            "vscode",
            requested_skills=["vscode-workspace-execution"],
        )
        web_selected = select_prompt_skills(
            skills,
            "situational",
            "web",
            requested_skills=["vscode-workspace-execution"],
        )

        self.assertEqual([], diagnostics)
        self.assertEqual(
            ["vscode-workspace-execution"],
            [skill.manifest.name for skill in vscode_selected],
        )
        self.assertEqual([], web_selected)

    def test_invalid_manifest_is_reported_and_not_selected(self):
        self.write_skill(
            "situational",
            "invalid.md",
            """---
name: invalid
kind: situational
unsupported_field: true
---
This must not reach a prompt.
""",
        )

        skills, diagnostics = load_prompt_skills(self.skills_directory, "situational")

        self.assertEqual([], skills)
        self.assertEqual(1, len(diagnostics))
        self.assertIn("unsupported manifest fields", diagnostics[0].message)

    def test_line_endings_crlf_handled_correctly(self):
        crlf_content = "---\r\nname: crlf-test\r\nkind: mandatory\r\npriority: 10\r\n---\r\nUniversal body.\r\n"
        self.write_skill("mendatory", "crlf-test.md", crlf_content)

        skills, diagnostics = load_prompt_skills(self.skills_directory, "mandatory")
        self.assertEqual([], diagnostics)
        self.assertEqual(1, len(skills))
        self.assertEqual("crlf-test", skills[0].manifest.name)
        self.assertEqual("Universal body.", skills[0].body.strip())

    def test_duplicate_names_raises_error(self):
        self.write_skill(
            "mendatory",
            "first.md",
            """---
name: duplicate-name
kind: mandatory
---
First body.
""",
        )
        self.write_skill(
            "mendatory",
            "second.md",
            """---
name: duplicate-name
kind: mandatory
---
Second body.
""",
        )
        skills, diagnostics = load_prompt_skills(self.skills_directory, "mandatory")
        self.assertEqual(1, len(skills))
        self.assertEqual(1, len(diagnostics))
        self.assertIn("duplicate skill name", diagnostics[0].message)

    def test_empty_body_is_parsed_cleanly(self):
        self.write_skill(
            "mendatory",
            "empty-body.md",
            """---
name: empty-body
kind: mandatory
---
""",
        )
        skills, diagnostics = load_prompt_skills(self.skills_directory, "mandatory")
        self.assertEqual([], diagnostics)
        self.assertEqual(1, len(skills))
        self.assertEqual("", skills[0].body.strip())

    def test_validator_detects_all_issues(self):
        # 1. Name mismatch (filename stem is mismatched-stem, but name is custom-name)
        self.write_skill(
            "mendatory",
            "mismatched-stem.md",
            """---
name: custom-name
kind: mandatory
---
Body
""",
        )
        # 2. Kind mismatch (mandatory file placed in situational)
        self.write_skill(
            "situational",
            "kind-mismatch.md",
            """---
name: kind-mismatch
kind: mandatory
---
Body
""",
        )
        # 3. Mandatory skill requiring capability
        self.write_skill(
            "mendatory",
            "privileged-mandatory.md",
            """---
name: privileged-mandatory
kind: mandatory
requires_capabilities: [shell.execute]
---
Body
""",
        )
        # 4. Situational skill without triggers
        self.write_skill(
            "situational",
            "missing-triggers.md",
            """---
name: missing-triggers
kind: situational
triggers: []
---
Body
""",
        )

        errors = validate_prompt_skills(self.skills_directory)
        messages = [err.message for err in errors]

        self.assertTrue(any("does not match filename stem" in msg for msg in messages))
        self.assertTrue(
            any(
                "does not match 'situational' directory" in msg or "kind" in msg
                for msg in messages
            )
        )
        self.assertTrue(
            any("requires privileged capabilities" in msg for msg in messages)
        )
        self.assertTrue(any("missing trigger tags" in msg for msg in messages))


if __name__ == "__main__":
    unittest.main()
