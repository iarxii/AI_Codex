import os
import logging
import asyncio
from typing import Optional
from backend.config import settings
from backend.skills.sandbox import SandboxResult, execute_sandboxed

logger = logging.getLogger(__name__)

FORBIDDEN_SERVER_COMMANDS = {
    "uvicorn", "gunicorn", "flask run", "fastapi dev", "fastapi run",
    "python -m http.server", "python3 -m http.server", "node server.js",
    "nodemon", "express", "django-admin runserver", "manage.py runserver"
}

class CloudRunSandboxExecutor:
    """
    Executes commands inside a Cloud Run container sandbox for GCP project `aicodex-lab`.
    Falls back to local sandboxed subprocess if Cloud Run service is unreachable.
    Enforces strict command guardrails (disallowing live backend server daemons).
    """
    def __init__(self, project_id: Optional[str] = None, region: Optional[str] = None):
        self.project_id = project_id or settings.GCP_PROJECT_ID
        self.region = region or settings.GCP_REGION
        self.service_name = settings.CLOUDRUN_SERVICE_NAME

    async def execute(self, command: str, cwd: str = ".", conversation_id: Optional[str] = None) -> SandboxResult:
        """
        Executes command via Cloud Run Job / Container API or gcloud CLI wrapper.
        """
        cmd_lower = command.lower().strip()
        if any(forbidden in cmd_lower for forbidden in FORBIDDEN_SERVER_COMMANDS):
            logger.info(f"[CloudRunSandbox] Intercepted forbidden backend server execution: '{command}'")
            return SandboxResult(
                success=False,
                output=(
                    "🛑 Backend Server Execution Guardrail: Live backend server processes (FastAPI, Express, Flask) "
                    "are disabled in sandbox previews for security and cost efficiency.\n"
                    "Backend source files have been saved to your workspace repo. "
                    "Live UI previews use client-side mock handlers."
                ),
                return_code=403,
                data={
                    "guardrail_triggered": "backend_server_forbidden",
                    "command": command,
                    "policy": "frontend_only_preview"
                }
            )

        logger.info(f"CloudRun Sandbox Dispatch: executing '{command}' on GCP Project '{self.project_id}'")
        
        # If SANDBOX_MODE is local or GCP project not configured, fallback to local execution
        if settings.SANDBOX_MODE != "cloudrun":
            return await execute_sandboxed(command, cwd=cwd, conversation_id=conversation_id)

        try:
            # Build gcloud run / curl request or gcloud exec command string
            gcloud_cmd = (
                f"gcloud run jobs execute {self.service_name} "
                f"--project={self.project_id} --region={self.region} --wait "
                f"--args=\"{command}\""
            )
            
            proc = await asyncio.create_subprocess_shell(
                gcloud_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=settings.MAX_EXECUTION_TIME
            )
            
            stdout_str = stdout.decode(errors="replace").strip()
            stderr_str = stderr.decode(errors="replace").strip()
            
            if proc.returncode == 0:
                return SandboxResult(
                    success=True,
                    output=stdout_str,
                    return_code=0,
                    data={"stdout": stdout_str, "stderr": stderr_str, "provider": "cloudrun", "project": self.project_id}
                )
            else:
                logger.warning(f"CloudRun execution non-zero code ({proc.returncode}). Falling back to local sandbox: {stderr_str}")
                return await execute_sandboxed(command, cwd=cwd, conversation_id=conversation_id)
        except Exception as err:
            logger.error(f"CloudRun sandbox execution failed: {err}. Falling back to local execution.")
            return await execute_sandboxed(command, cwd=cwd, conversation_id=conversation_id)


async def get_sandbox_executor() -> CloudRunSandboxExecutor:
    return CloudRunSandboxExecutor()
