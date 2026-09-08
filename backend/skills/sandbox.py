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

ACTIVE_PROCESSES = {}

async def kill_active_process(conversation_id: str) -> bool:
    """Terminates an active subprocess for a given conversation."""
    proc = ACTIVE_PROCESSES.get(conversation_id)
    if proc:
        try:
            # On Windows, proc.kill() sends TerminateProcess.
            proc.kill()
            del ACTIVE_PROCESSES[conversation_id]
            return True
        except Exception:
            pass
    return False

import sys
import os

async def execute_sandboxed(command: str, cwd: str = ".", conversation_id: Optional[str] = None, shell: str = "default") -> SandboxResult:
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
    # Block command injection and chaining
    blocked_operators = [";", "&&", "||", "|", ">", "<", "`", "$("]
    for op in blocked_operators:
        if op in command:
            return SandboxResult(success=False, error=f"Security Violation: Operator '{op}' is not allowed in commands.")

    if base_cmd not in allowed_cmds:
        return SandboxResult(success=False, error=f"Command '{base_cmd}' not in allowlist")

    try:
        normalized_shell = (shell or "default").strip().lower()
        is_win = sys.platform == "win32"

        if normalized_shell == "powershell":
            ps_exe = "powershell.exe" if is_win else "pwsh"
            proc = await asyncio.create_subprocess_exec(
                ps_exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command,
                cwd=cwd,
                stdout=PIPE,
                stderr=PIPE
            )
        elif normalized_shell == "cmd" and is_win:
            comspec = os.environ.get("ComSpec", "cmd.exe")
            proc = await asyncio.create_subprocess_exec(
                comspec, "/D", "/C", command,
                cwd=cwd,
                stdout=PIPE,
                stderr=PIPE
            )
        elif normalized_shell == "bash":
            bash_exe = "bash.exe" if is_win else "/bin/bash"
            proc = await asyncio.create_subprocess_exec(
                bash_exe, "-c", command,
                cwd=cwd,
                stdout=PIPE,
                stderr=PIPE
            )
        else:
            # default / fallback shell execution
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=cwd,
                stdout=PIPE,
                stderr=PIPE
            )
        
        if conversation_id:
            ACTIVE_PROCESSES[conversation_id] = proc
            
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
        except asyncio.CancelledError:
            try:
                proc.kill()
            except:
                pass
            return SandboxResult(success=False, error="Execution cancelled by user")
        finally:
            if conversation_id and conversation_id in ACTIVE_PROCESSES:
                del ACTIVE_PROCESSES[conversation_id]

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
