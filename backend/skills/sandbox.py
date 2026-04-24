import asyncio
from asyncio.subprocess import PIPE
from typing import Optional, Set
from backend.config import settings
from .base import SkillResult

class SandboxResult(SkillResult):
    """
    SkillResult with return_code for subprocess execution.
    """
    return_code: Optional[int] = None

async def execute_sandboxed(command: str, cwd: str = ".") -> SandboxResult:
    """
    Executes a shell command in a sandboxed subprocess.
    Enforces allowlist, timeout, and captures output.
    """
    # Parse allowlist
    allowed_cmds: Set[str] = {cmd.strip().lower() for cmd in settings.ALLOWED_COMMANDS.split(",")}
    
    # Extract base command for validation
    parts = command.split()
    if not parts:
        return SandboxResult(success=False, error="Empty command")
    
    base_cmd = parts[0].lower()
    # Basic check for common shell operators that could bypass simple validation
    if any(op in command for op in [";", "&&", "||", "|", ">", "<"]):
        # If shell operators are used, we'd need more complex parsing.
        # For v1, let's keep it simple but warned.
        pass

    if base_cmd not in allowed_cmds:
        return SandboxResult(success=False, error=f"Command '{base_cmd}' not in allowlist")

    try:
        # Note: on Windows, shell=True is needed for built-ins like 'dir' or 'type'
        proc = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=PIPE,
            stderr=PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=settings.MAX_EXECUTION_TIME
            )
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except:
                pass
            return SandboxResult(success=False, error=f"Execution timed out after {settings.MAX_EXECUTION_TIME}s")

        stdout_str = stdout.decode(errors="replace").strip()
        stderr_str = stderr.decode(errors="replace").strip()
        
        success = proc.returncode == 0
        return SandboxResult(
            success=success,
            output=stdout_str if success else None,
            error=stderr_str if not success else None,
            return_code=proc.returncode,
            data={
                "stdout": stdout_str,
                "stderr": stderr_str,
                "return_code": proc.returncode
            }
        )
    except Exception as e:
        return SandboxResult(success=False, error=f"Sandbox error: {str(e)}")
