import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..base import BaseSkill, SkillResult

class MemoryEvolutionSkill(BaseSkill):
    """
    Skill to evolve the agent's persistent project memory (MEMORY.md).
    """
    name = "memory_evolution"
    description = (
        "Updates or appends to the project's long-term memory file (MEMORY.md). "
        "Use this to persist key facts, lessons learned, or project milestones. "
        "Always structure your additions with dates if possible."
    )
    parameters = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["append", "overwrite"],
                "description": "Whether to append to the end of the memory file or overwrite it entirely."
            },
            "content": {
                "type": "string",
                "description": "The markdown text content to add to the memory."
            }
        },
        "required": ["action", "content"]
    }

    def _get_memory_path(self) -> Path:
        # Resolve project root (4 levels up from this file)
        root = Path(__file__).resolve().parents[3]
        memory_path = root / "data" / "profile" / "MEMORY.md"
        # Ensure directory exists
        memory_path.parent.mkdir(parents=True, exist_ok=True)
        return memory_path

    async def execute(self, action: str, content: str) -> SkillResult:
        try:
            path = self._get_memory_path()
            
            if action == "append":
                with open(path, "a", encoding="utf-8") as f:
                    # Add a newline and a date-stamped entry
                    f.write(f"\n{content}")
                return SkillResult(success=True, output="Memory appended successfully.")
            
            elif action == "overwrite":
                path.write_text(content, encoding="utf-8")
                return SkillResult(success=True, output="Memory file overwritten successfully.")
            
            return SkillResult(success=False, error=f"Unknown action: {action}")
            
        except Exception as e:
            return SkillResult(success=False, error=str(e))
