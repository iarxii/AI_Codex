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

def get_agent_tools(conversation_id: str = None) -> List[StructuredTool]:
    """
    Discovers all skills and returns them as a list of LangChain tools.
    """
    # Ensure skills are discovered
    registry.discover_builtin_skills()
    
    skills = registry.get_all_skills()
    tools = []
    
    for skill in skills:
        try:
            # We must preserve the signature for StructuredTool.from_function to work.
            # For the workspace_writer, we know its specific signature.
            if skill.name == "workspace_writer":
                async def wrapped_workspace_writer(filename: str, content: str, type: str = "code"):
                    return await skill.execute(filename=filename, content=content, type=type, conversation_id=conversation_id)
                
                tool = StructuredTool.from_function(
                    coroutine=wrapped_workspace_writer,
                    name=skill.name,
                    description=skill.description,
                )
            else:
                # Generic fallback for other skills (can be expanded)
                tool = StructuredTool.from_function(
                    coroutine=skill.execute,
                    name=skill.name,
                    description=skill.description,
                )
            tools.append(tool)
            logger.info(f"Converted skill to tool: {skill.name}")
        except Exception as e:
            logger.error(f"Failed to convert skill {skill.name} to tool: {e}")
            
    # Add native agent tools
    tools.append(codebase_search)
    
    return tools

@StructuredTool.from_function
async def codebase_search(query: str) -> str:
    """
    Search the codebase for relevant snippets, definitions, or documentation.
    Use this when you need context about how something is implemented.
    """
    from backend.integrations.ollamaopt_bridge import get_retriever
    retriever = get_retriever()
    if not retriever:
        return "Error: Codebase retriever not initialized."
    
    try:
        results = await retriever.retrieve(query)
        if not results:
            return "No relevant code snippets found for that query."
        
        formatted = []
        for r in results:
            formatted.append(f"--- {r.source_path} (Score: {r.score:.2f}) ---\n{r.content}")
        
        return "\n\n".join(formatted)
    except Exception as e:
        return f"Error during codebase search: {str(e)}"
