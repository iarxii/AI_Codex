import os
import subprocess
import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)

def generate_global_knowledge_map():
    """
    Aggregates all workspace graphs into a single global knowledge map.
    Uses 'graphify merge-graphs' to combine all graph.json files found in workspaces.
    """
    workspaces_root = Path("data/workspaces")
    output_dir = Path("data/admin/global-graph")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not workspaces_root.exists():
        logger.warning("Workspaces root directory not found.")
        return False

    # Collect all graph.json files
    graph_files = list(workspaces_root.glob("*/graphify-out/graph.json"))
    
    if not graph_files:
        logger.info("No workspace graphs found to merge.")
        return False

    logger.info(f"Merging {len(graph_files)} workspace graphs into global map...")

    # Build command
    import sys
    python_exe = sys.executable or "python"
    graphify_module = "graphify"

    
    # Add the submodule to PYTHONPATH
    env = os.environ.copy()
    submodule_path = str(Path("graphify").resolve())
    env["PYTHONPATH"] = f"{submodule_path}{os.pathsep}{env.get('PYTHONPATH', '')}"

    cmd = [python_exe, "-m", graphify_module, "merge-graphs"]
    cmd.extend([str(f) for f in graph_files])
    cmd.extend(["--out", str(output_dir / "graph.json")])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
            check=False
        )

        if result.returncode != 0:
            logger.error(f"Global graph merge failed: {result.stderr}")
            return False

        logger.info("Global knowledge map successfully updated.")
        return True

    except Exception as e:
        logger.exception("Error generating global knowledge map")
        return False
