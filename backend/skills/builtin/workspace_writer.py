import os
from pathlib import Path
from typing import Any, Dict, Optional
from ..base import BaseSkill, SkillResult
from backend.utils.storage import save_scratchpad_file

class WorkspaceWriterSkill(BaseSkill):
    """
    Skill to write or update files in the workspace scratchpad.
    """
    name = "workspace_writer"
    description = (
        "Updates the code scratchpad for the current conversation. "
        "Use this to generate or modify code, documentation, or research notes. "
        "The content will appear in the Agent Canvas."
    )
    parameters = {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "The name of the file (e.g., 'main.py', 'README.md')."
            },
            "content": {
                "type": "string",
                "description": "The full content to write to the file."
            },
            "type": {
                "type": "string",
                "enum": ["code", "docs", "research"],
                "description": "The type of content being written.",
                "default": "code"
            }
        },
        "required": ["filename", "content"]
    }

    async def execute(self, filename: str, content: str, type: str = "code", conversation_id: Optional[str] = None) -> SkillResult:
        if not conversation_id:
            return SkillResult(success=False, error="No active conversation ID provided in tool context.")

        try:
            # Security: Ensure filename is safe
            safe_filename = os.path.basename(filename)
            if not safe_filename:
                return SkillResult(success=False, error="Invalid filename provided.")

            local_path = save_scratchpad_file(
                session_id=conversation_id,
                filename=safe_filename,
                content=content
            )

            # We return a message that includes the CANVAS tag so the frontend can still parse it if needed,
            # though the backend save is now primary.
            canvas_tag = f"[CANVAS:{type.upper()}:{safe_filename}]{content}[/CANVAS]"
            
            return SkillResult(
                success=True, 
                output=f"Successfully updated {safe_filename} in the workspace scratchpad.",
                data={
                    "path": local_path,
                    "filename": safe_filename,
                    "canvas_marker": canvas_tag
                }
            )
        except Exception as e:
            return SkillResult(success=False, error=str(e))
