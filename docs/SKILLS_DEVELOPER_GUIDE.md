# Skills Developer Guide

Skills are the "hands" of the AICodex agent. They allow the agent to interact with the file system, execute code, and perform external research.

## 🏗️ Skill Architecture

All skills inherit from `BaseSkill` in `backend/skills/base.py`.

### Anatomy of a Skill
```python
class MyCustomSkill(BaseSkill):
    name = "my_skill"
    description = "What this skill does (seen by the LLM)"
    parameters = {
        "type": "object",
        "properties": {
            "param1": {"type": "string", "description": "..."}
        },
        "required": ["param1"]
    }

    async def execute(self, param1: str) -> SkillResult:
        # Implementation logic
        return SkillResult(success=True, output="...")
```

---

## 🛡️ Sandbox & Security

For safety, shell-based skills MUST use the `execute_sandboxed` utility.

### 1. Command Allowlist
Only commands listed in `settings.ALLOWED_COMMANDS` (in `.env`) can be executed.
- Default: `git, python, pip, node, npm, dir, type, cat, ls`

### 2. Operator Blocking
The sandbox now blocks shell chaining and redirection to prevent injection:
- Blocked: `;`, `&&`, `||`, `|`, `>`, `<`, `` ` ``, `$()`

### 3. Resource Constraints
- **Timeout**: Commands are killed after 30 seconds by default (`MAX_EXECUTION_TIME`).
- **CWD Validation**: The `ShellExecSkill` verifies that the target directory is within the project root.

---

## 📦 Built-in Skills

| Skill | Description | Target |
|:------|:------------|:-------|
| `shell_exec` | Runs allowed CLI commands | Sandbox |
| `workspace_reader`| Reads/lists/searches files | Local FS |
| `rag_query` | Semantic search over project | Vector Store|
| `url_reader` | Fetches and cleans web content | External |
| `github_search` | Searches GitHub repositories | GitHub API |
| `memory_skill` | Manages agent persistent memory | DB |

---

## 🛠️ Registering a Skill

AICodex uses an **Auto-Discovery** pattern.
1. Create your skill file in `backend/skills/builtin/`.
2. Add the class to the registry in `backend/skills/registry.py`.
3. The agent will automatically see the new tool in its next reasoning turn.

---

## 💡 Best Practices

- **Concise Output**: LLMs struggle with multi-megabyte tool results. Truncate outputs where appropriate.
- **Clear Parameters**: Use descriptive names and JSON schema types.
- **Fail Gracefully**: Always return a `SkillResult(success=False, error="...")` instead of raising an unhandled exception.
