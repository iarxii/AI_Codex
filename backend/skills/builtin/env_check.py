import os
import sys
import platform
import subprocess
from pathlib import Path
from ..base import BaseSkill, SkillResult

class EnvCheckSkill(BaseSkill):
    """
    Skill to perform pre-flight checks on the environment (OS, Shell, Paths, and availability of system dependencies).
    """
    name = "env_check"
    description = (
        "Performs a pre-flight environment check to verify OS, platform details, active shell type, "
        "and checks if specific system dependencies/binaries (e.g. git, python, nvcc, npm) are available in the PATH."
    )
    parameters = {
        "type": "object",
        "properties": {
            "dependencies": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "description": "List of command line tools/executables to check (e.g., ['git', 'python', 'npm', 'nvcc'])."
            }
        },
        "required": []
    }

    async def execute(self, dependencies: list = None, conversation_id: str = None) -> SkillResult:
        try:
            # 1. OS & Platform Details
            info = {
                "os": platform.system(),
                "os_release": platform.release(),
                "os_version": platform.version(),
                "architecture": platform.machine(),
                "python_version": sys.version,
                "current_working_directory": os.getcwd()
            }
            
            # 2. Detect Shell
            shell = os.environ.get("SHELL") or os.environ.get("COMSPEC")
            if not shell:
                if platform.system() == "Windows":
                    shell = "powershell.exe"
                else:
                    shell = "/bin/sh"
            info["shell"] = shell
            
            # 3. Check Dependencies
            dep_status = {}
            tools_to_check = dependencies if dependencies else ["git", "python", "npm", "node"]
            
            for tool in tools_to_check:
                cmd = "where" if platform.system() == "Windows" else "which"
                try:
                    proc = subprocess.run([cmd, tool], capture_output=True, text=True, check=True)
                    path = proc.stdout.strip().split("\n")[0]
                    dep_status[tool] = {
                        "available": True,
                        "path": path
                    }
                except subprocess.CalledProcessError:
                    dep_status[tool] = {
                        "available": False,
                        "path": None
                    }
            
            info["dependencies"] = dep_status
            
            return SkillResult(success=True, data=info)
            
        except Exception as e:
            return SkillResult(success=False, error=f"Environment check failed: {str(e)}")
