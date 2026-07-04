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
        # This execution is delegated to the VSCode client by the agent orchestrator.
        # This execute method acts as a fallback or placeholder.
        return SkillResult(
            success=True,
            output="Delegated to client patcher"
        )
