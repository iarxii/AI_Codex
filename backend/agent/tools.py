import logging
from typing import List
from langchain_core.tools import StructuredTool
from backend.skills.registry import registry
from backend.skills.base import BaseSkill

logger = logging.getLogger(__name__)

def skill_to_langchain_tool(skill: BaseSkill) -> StructuredTool:
    """
    Wraps a BaseSkill's execute method into a LangChain StructuredTool.
    StructuredTool.from_function will inspect the 'execute' signature 
    to create the appropriate arguments schema.
    """
    return StructuredTool.from_function(
        coroutine=skill.execute,
        name=skill.name,
        description=skill.description,
    )

def get_agent_tools() -> List[StructuredTool]:
    """
    Discovers all skills and returns them as a list of LangChain tools.
    """
    # Ensure skills are discovered
    registry.discover_builtin_skills()
    
    skills = registry.get_all_skills()
    tools = []
    
    for skill in skills:
        try:
            tools.append(skill_to_langchain_tool(skill))
            logger.info(f"Converted skill to tool: {skill.name}")
        except Exception as e:
            logger.error(f"Failed to convert skill {skill.name} to tool: {e}")
            
    return tools
