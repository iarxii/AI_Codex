from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import reason_node, execute_tool_node, init_node, guard_node
from .trading_nodes import bull_bear_debate_node, mql5_execution_enforcer_node

def should_continue(state: AgentState):
    """
    Check if tool calls are present.
    """
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        # If in trading space, we route to the enforcer first
        slug = state.get("space_config", {}).get("slug", "")
        if slug == "trading-space":
            return "mql5_enforcer"
        return "execute_tool"
    return END

def route_after_init(state: AgentState):
    """
    Route based on Codex Space type.
    """
    space_config = state.get("space_config", {})
    slug = space_config.get("slug", "")
    
    if slug == "trading-space":
        return "trading_debate"
    
    return "reason"

def create_agent_graph():
    """
    Creates and compiles the agent graph.
    """
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("init", init_node)
    workflow.add_node("guard", guard_node)
    workflow.add_node("reason", reason_node)
    workflow.add_node("execute_tool", execute_tool_node)
    workflow.add_node("trading_debate", bull_bear_debate_node)
    workflow.add_node("mql5_enforcer", mql5_execution_enforcer_node)
    
    # Set entry point
    workflow.set_entry_point("init")
    
    # Add conditional edges out of init
    workflow.add_conditional_edges(
        "init",
        route_after_init,
        {
            "trading_debate": "trading_debate",
            "reason": "guard"
        }
    )
    
    # Guard → Reason (guard validates context before LLM invocation)
    workflow.add_edge("guard", "reason")
    
    # After debate, go to guard (then reason)
    workflow.add_edge("trading_debate", "guard")
    
    # Add conditional edges
    workflow.add_conditional_edges(
        "reason",
        should_continue,
        {
            "mql5_enforcer": "mql5_enforcer",
            "execute_tool": "execute_tool",
            END: END
        }
    )
    
    # After enforcer, if not vetoed (no error), go to execute tool. If vetoed, go back to reason.
    def after_enforcer(state: AgentState):
        if state.get("error") == "MQL5_GATE_LOCKED":
            return "reason"
        return "execute_tool"

    workflow.add_conditional_edges(
        "mql5_enforcer",
        after_enforcer,
        {
            "reason": "reason",
            "execute_tool": "execute_tool"
        }
    )
    
    # Add normal edges
    workflow.add_edge("execute_tool", "guard")
    
    # Compile
    return workflow.compile()
