import os
import subprocess
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from ..base import BaseSkill, SkillResult

logger = logging.getLogger(__name__)

class GraphifySkill(BaseSkill):
    """
    Skill to interact with the graphify knowledge graph engine.
    """
    name = "graphify"
    description = (
        "Interacts with the Graphify knowledge graph engine. "
        "Use this to rebuild, update, or query the structural map of the current workspace."
    )
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["rebuild", "update", "query"],
                "description": "The action to perform."
            },
            "query_text": {
                "type": "string",
                "description": "The natural language query (required for action='query')."
            }
        },
        "required": ["action"]
    }

    async def execute(self, action: str, query_text: Optional[str] = None, conversation_id: Optional[str] = None) -> SkillResult:
        if not conversation_id:
            return SkillResult(success=False, error="No active conversation ID provided.")

        from backend.config import WORKSPACES_DIR
        workspace_dir = WORKSPACES_DIR / conversation_id / "scratch"
        output_dir = WORKSPACES_DIR / conversation_id / "graphify-out"
        
        # Ensure directories exist
        workspace_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Base command
        # We run from the project root but point to the submodule
        # python -m graphify <path> --out <output>
        python_exe = "python"
        graphify_module = "graphify"
        
        # Add the submodule to PYTHONPATH so we can run it
        env = os.environ.copy()
        submodule_path = str(Path("graphify").resolve())
        env["PYTHONPATH"] = f"{submodule_path}{os.pathsep}{env.get('PYTHONPATH', '')}"

        try:
            if action == "rebuild":
                cmd = [python_exe, "-m", graphify_module, str(workspace_dir), "--out", str(output_dir)]
            elif action == "update":
                cmd = [python_exe, "-m", graphify_module, str(workspace_dir), "--out", str(output_dir), "--update"]
            elif action == "query":
                if not query_text:
                    return SkillResult(success=False, error="Query text is required for 'query' action.")
                graph_json = output_dir / "graph.json"
                if not graph_json.exists():
                    return SkillResult(success=False, error="Graph has not been generated yet. Run 'rebuild' first.")
                cmd = [python_exe, "-m", graphify_module, "query", query_text, "--graph", str(graph_json)]
            else:
                return SkillResult(success=False, error=f"Unknown action: {action}")

            logger.info(f"Executing graphify command: {' '.join(cmd)}")
            
            # Run the command
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env,
                check=False
            )

            if result.returncode != 0:
                return SkillResult(
                    success=False, 
                    error=f"Graphify failed: {result.stderr}",
                    data={"stdout": result.stdout}
                )

            return SkillResult(
                success=True,
                output=f"Graphify {action} completed successfully.\n{result.stdout}",
                data={"stdout": result.stdout, "output_dir": str(output_dir)}
            )

        except Exception as e:
            logger.exception("Error executing GraphifySkill")
            return SkillResult(success=False, error=str(e))
