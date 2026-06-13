import os
import asyncio
from pathlib import Path
from typing import Any, Dict, Optional
from ..base import BaseSkill, SkillResult
from ..registry import registry
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
            },
            "tutor_explanation": {
                "type": "string",
                "description": "Educational explanation of the code/artifact by Spirit Bird."
            }
        },
        "required": ["filename", "content"]
    }

    async def execute(self, filename: str, content: str, type: str = "code", tutor_explanation: Optional[str] = None, conversation_id: Optional[str] = None) -> SkillResult:
        if not conversation_id:
            return SkillResult(success=False, error="No active conversation ID provided in tool context.")

        try:
            # Security: Ensure filename is safe and remains within the workspace
            norm_filename = os.path.normpath(filename)
            if norm_filename.startswith("..") or os.path.isabs(norm_filename):
                return SkillResult(success=False, error="Security violation: Path must be relative and remain within the workspace.")

            local_path = save_scratchpad_file(
                session_id=conversation_id,
                filename=norm_filename,
                content=content
            )

            # Use forward slashes for cross-platform UI representation
            display_filename = norm_filename.replace(os.path.sep, "/")

            # Generate the CANVAS marker for the UI
            # Format: [CANVAS:TYPE:TITLE:LANGUAGE:PATH] CONTENT [/CANVAS]
            # We embed the [TUTOR] block inside if explanation is provided
            
            display_content = content
            if tutor_explanation:
                display_content = f"{content}\n\n[TUTOR]\n{tutor_explanation}\n[/TUTOR]"
            
            # Extract language from extension if not provided
            lang = "text"
            if "." in display_filename:
                ext = display_filename.split(".")[-1]
                lang_map = {"py": "python", "js": "javascript", "ts": "typescript", "tsx": "tsx", "html": "html", "css": "css"}
                lang = lang_map.get(ext, ext)

            canvas_marker = f"[CANVAS:{type}:{display_filename}:{lang}] {display_content} [/CANVAS]"

            # Trigger non-blocking graphify update
            graph_skill = registry.get_skill("graphify")
            if graph_skill:
                # We run this in the background to not block the main response
                asyncio.create_task(graph_skill.execute(action="update", conversation_id=conversation_id))

            return SkillResult(
                success=True, 
                output=f"Successfully updated {display_filename} in the workspace scratchpad.",
                data={
                    "path": local_path,
                    "filename": display_filename,
                    "canvas_marker": canvas_marker,
                    "tutor_explanation": tutor_explanation
                }
            )
        except Exception as e:
            return SkillResult(success=False, error=str(e))
