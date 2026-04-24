from typing import Annotated, List, Optional, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    Represents the state of the AICodex agentic loop.
    """
    # The conversation history
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Active tool calls (for UI rendering)
    current_tool_calls: List[dict]
    
    # Assembled context from RAG/Memory (from OllamaOpt)
    context_data: dict
    
    # Hardware routing info (NPU/GPU/CPU)
    routing_decision: dict
    
    # Final answer flag
    is_complete: bool
    
    # Error state if any
    error: Optional[str]
