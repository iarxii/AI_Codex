from pathlib import Path
from ..base import BaseSkill, SkillResult
from ..sandbox import execute_sandboxed

class ShellExecSkill(BaseSkill):
    """
    Skill to execute shell commands in a sandboxed environment.
    """
    name = "shell_exec"
    description = (
        "Executes a shell command within a sandboxed environment. "
        "Enforces an allowlist of permitted commands and a timeout."
    )
    parameters = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "The full command string to execute (e.g., 'git status')."
            },
            "cwd": {
                "type": "string",
                "description": "The working directory relative to the project root.",
                "default": "."
            }
        },
        "required": ["command"]
    }

    async def execute(self, command: str, cwd: str = ".") -> SkillResult:
        try:
            # Resolve absolute CWD
            root = Path(__file__).resolve().parents[3]
            abs_cwd = (root / cwd).resolve()
            
            # Security check for CWD
            if not str(abs_cwd).startswith(str(root)):
                 return SkillResult(success=False, error="Access denied: CWD is outside workspace root.")

            # Execute via sandbox
            result = await execute_sandboxed(command, cwd=str(abs_cwd))
            return result
            
        except Exception as e:
            return SkillResult(success=False, error=f"Shell execution failed: {str(e)}")
