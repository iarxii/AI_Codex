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

    async def execute(self, command: str, cwd: str = ".", conversation_id: str = None) -> SkillResult:
        try:
            # Resolve absolute CWD
            root = Path(__file__).resolve().parents[3]
            
            if conversation_id:
                # Resolve relative to the conversation scratchpad
                base_dir = (root / "data" / "workspaces" / conversation_id / "scratch").resolve()
            else:
                base_dir = root.resolve()

            abs_cwd = (base_dir / cwd).resolve()
            
            # Security check for CWD: must remain within base_dir
            if not str(abs_cwd).startswith(str(base_dir)):
                 return SkillResult(success=False, error="Access denied: CWD is outside workspace root.")

            # Ensure the directory exists
            abs_cwd.mkdir(parents=True, exist_ok=True)

            # Execute via sandbox
            result = await execute_sandboxed(command, cwd=str(abs_cwd), conversation_id=conversation_id)
            return result
            
        except Exception as e:
            return SkillResult(success=False, error=f"Shell execution failed: {str(e)}")
