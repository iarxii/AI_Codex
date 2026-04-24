import json
from typing import Any, Dict, List
from langchain_ollama import ChatOllama
from langchain_core.messages import ToolMessage
from .state import AgentState
from backend.config import settings
from backend.integrations.ollamaopt_bridge import get_context_builder

# Initialize the LLM
llm = ChatOllama(
    model=settings.DEFAULT_MODEL,
    base_url=settings.OLLAMA_BASE_URL,
    temperature=0
)

async def reason_node(state: AgentState) -> Dict[str, Any]:
    """
    LLM reasoning node. Bound with tools.
    """
    # TODO: Build context using OllamaOpt ContextBuilder
    # For now, just pass the messages
    
    # bind_tools would happen in graph definition
    response = await llm.ainvoke(state["messages"])
    
    return {
        "messages": [response],
        "current_tool_calls": getattr(response, "tool_calls", [])
    }

async def execute_tool_node(state: AgentState) -> Dict[str, Any]:
    """
    Tool execution node.
    """
    last_message = state["messages"][-1]
    tool_messages = []
    
    for tool_call in last_message.tool_calls:
        # TODO: Dispatch to SkillRegistry
        # Dummy execution for now
        tool_result = f"Result of {tool_call['name']}"
        
        tool_messages.append(
            ToolMessage(
                content=tool_result,
                tool_call_id=tool_call["id"]
            )
        )
        
    return {"messages": tool_messages, "current_tool_calls": []}
