from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import reason_node, execute_tool_node

def should_continue(state: AgentState):
    """
    Check if tool calls are present.
    """
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "execute_tool"
    return END

def create_agent_graph():
    """
    Creates and compiles the agent graph.
    """
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("reason", reason_node)
    workflow.add_node("execute_tool", execute_tool_node)
    
    # Set entry point
    workflow.set_entry_point("reason")
    
    # Add conditional edges
    workflow.add_conditional_edges(
        "reason",
        should_continue,
        {
            "execute_tool": "execute_tool",
            END: END
        }
    )
    
    # Add normal edges
    workflow.add_edge("execute_tool", "reason")
    
    # Compile
    return workflow.compile()
