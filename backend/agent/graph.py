from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import reason_node, execute_tool_node, init_node
from .trading_nodes import bull_bear_debate_node

def should_continue(state: AgentState):
    """
    Check if tool calls are present.
    """
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "execute_tool"
    return END

def route_after_init(state: AgentState):
    """
    Route based on Codex Space type.
    """
    space_config = state.get("space_config", {})
    slug = space_config.get("slug", "")
    
    if slug == "financial_trading":
        return "trading_debate"
    
    return "reason"

def create_agent_graph():
    """
    Creates and compiles the agent graph.
    """
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("init", init_node)
    workflow.add_node("reason", reason_node)
    workflow.add_node("execute_tool", execute_tool_node)
    workflow.add_node("trading_debate", bull_bear_debate_node)
    
    # Set entry point
    workflow.set_entry_point("init")
    
    # Add conditional edges out of init
    workflow.add_conditional_edges(
        "init",
        route_after_init,
        {
            "trading_debate": "trading_debate",
            "reason": "reason"
        }
    )
    
    # After debate, go to reason
    workflow.add_edge("trading_debate", "reason")
    
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
