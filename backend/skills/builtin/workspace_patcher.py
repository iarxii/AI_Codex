import os
from typing import Optional
from ..base import BaseSkill, SkillResult

class WorkspacePatcherSkill(BaseSkill):
    """
    Skill to patch files in the workspace.
    """
    name = "workspace_patcher"
    description = (
        "Updates an existing file in the workspace by replacing a specific block of text. "
        "Use this for modifying existing code files instead of rewriting the entire file. "
        "The search_string must exactly match a unique block of text in the file."
    )
    parameters = {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "The name or relative path of the file to patch."
            },
            "search_string": {
                "type": "string",
                "description": "The exact block of text to replace. Must match the existing file content perfectly, including whitespace, indentation, and newlines."
            },
            "replace_string": {
                "type": "string",
                "description": "The new block of text that will replace the search_string."
            },
            "tutor_explanation": {
                "type": "string",
                "description": "Educational explanation of the change."
            }
        },
        "required": ["filename", "search_string", "replace_string"]
    }

    async def execute(self, filename: str, search_string: str, replace_string: str, tutor_explanation: Optional[str] = None, conversation_id: Optional[str] = None) -> SkillResult:
        try:
            from backend.config import PROJECT_ROOT, WORKSPACES_DIR
            if conversation_id:
                base_dir = (WORKSPACES_DIR / conversation_id / "scratch").resolve()
            else:
                base_dir = PROJECT_ROOT.resolve()
                
            abs_path = (base_dir / filename).resolve()
            
            # Security: Ensure path is within base_dir
            if not str(abs_path).startswith(str(base_dir)):
                return SkillResult(success=False, error="Access denied: Path is outside workspace root.")
                
            if not abs_path.is_file():
                return SkillResult(success=False, error=f"File '{filename}' does not exist.")
                
            content = abs_path.read_text(encoding="utf-8")
            
            occurrences = content.count(search_string)
            if occurrences == 0:
                return SkillResult(
                    success=False,
                    error=f"Search string not found in '{filename}'. Ensure exact match including whitespace."
                )
            elif occurrences > 1:
                return SkillResult(
                    success=False,
                    error=f"Search string found {occurrences} times in '{filename}'. Please provide a more unique block of text to replace."
                )
                
            new_content = content.replace(search_string, replace_string)
            abs_path.write_text(new_content, encoding="utf-8")
            
            return SkillResult(
                success=True,
                output=f"Successfully patched {filename}.",
                data={
                    "filename": filename,
                    "content": new_content,
                    "tutor_explanation": tutor_explanation
                }
            )
            
        except Exception as e:
            return SkillResult(success=False, error=f"Failed to patch file: {str(e)}")
