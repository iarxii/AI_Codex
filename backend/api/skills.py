from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from backend.skills.registry import registry
from pydantic import BaseModel

router = APIRouter()

class SkillInfo(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]

@router.get("/", response_model=List[SkillInfo])
async def list_skills():
    """
    List all registered skills and their metadata.
    """
    registry.discover_builtin_skills()
    skills = registry.get_all_skills()
    return [
        SkillInfo(
            name=s.name,
            description=s.description,
            parameters=s.parameters
        ) for s in skills
    ]

@router.post("/{skill_name}/test")
async def test_skill(skill_name: str, params: Dict[str, Any]):
    """
    Test-execute a specific skill.
    """
    skill = registry.get_skill(skill_name)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found.")
    
    try:
        result = await skill.execute(**params)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
