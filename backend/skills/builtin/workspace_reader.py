import os
from pathlib import Path
from backend.config import PROJECT_ROOT, WORKSPACES_DIR
from typing import Any, Dict, List, Optional
from ..base import BaseSkill, SkillResult

class WorkspaceReaderSkill(BaseSkill):
    """
    Skill to read and explore the local workspace.
    """
    name = "workspace_reader"
    description = (
        "Reads file contents, lists directory structures, or searches for patterns "
        "within the project workspace."
    )
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["read", "list", "search"],
                "description": "The action to perform: 'read' (file content), 'list' (directory tree), or 'search' (grep)."
            },
            "path": {
                "type": "string",
                "description": "The path relative to the project root."
            },
            "query": {
                "type": "string",
                "description": "The search pattern (required for 'search')."
            },
            "recursive": {
                "type": "boolean",
                "description": "Whether to list or search recursively.",
                "default": False
            }
        },
        "required": ["action", "path"]
    }

    def _get_abs_path(self, rel_path: str, conversation_id: Optional[str] = None) -> Path:
        if conversation_id:
            base_dir = (WORKSPACES_DIR / conversation_id / "scratch").resolve()
        else:
            base_dir = PROJECT_ROOT.resolve()
            
        abs_path = (base_dir / rel_path).resolve()
        # Security: Ensure path is within base_dir
        if not str(abs_path).startswith(str(base_dir)):
            raise ValueError("Access denied: Path is outside workspace root.")
        return abs_path

    async def execute(self, action: str, path: str, query: Optional[str] = None, recursive: bool = False, conversation_id: Optional[str] = None) -> SkillResult:
        try:
            abs_path = self._get_abs_path(path, conversation_id=conversation_id)
            
            if action == "read":
                if not abs_path.is_file():
                    return SkillResult(success=False, error=f"'{path}' is not a file.")
                content = abs_path.read_text(errors="replace")
                return SkillResult(success=True, output=content)
                
            elif action == "list":
                if not abs_path.is_dir():
                    return SkillResult(success=False, error=f"'{path}' is not a directory.")
                
                items = []
                pattern = "**/*" if recursive else "*"
                for p in abs_path.glob(pattern):
                    rel = p.relative_to(abs_path)
                    items.append(f"{'[DIR] ' if p.is_dir() else '[FILE]'} {rel}")
                
                return SkillResult(success=True, output="\n".join(items))
                
            elif action == "search":
                if not query:
                    return SkillResult(success=False, error="Query is required for 'search' action.")
                
                results = []
                pattern = "**/*" if recursive else "*"
                for p in abs_path.glob(pattern):
                    if p.is_file():
                        try:
                            content = p.read_text(errors="replace")
                            if query in content:
                                results.append(f"Match in {p.relative_to(abs_path)}")
                        except:
                            continue
                
                return SkillResult(
                    success=True, 
                    output="\n".join(results) if results else "No matches found.",
                    data={"matches": results}
                )
            
            return SkillResult(success=False, error=f"Unknown action: {action}")
            
        except Exception as e:
            return SkillResult(success=False, error=str(e))
