from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel

class SkillResult(BaseModel):
    """
    Standardized result for skill execution.
    """
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class BaseSkill(ABC):
    """
    Abstract base class for all AICodex skills.
    """
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema for tool parameters

    @abstractmethod
    async def execute(self, **kwargs) -> SkillResult:
        """
        Execute the skill logic.
        """
        pass
