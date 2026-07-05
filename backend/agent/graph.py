from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import (
    reason_node, execute_tool_node, init_node, guard_node,
    validate_response_node, verification_node, evaluate_turn_node,
    final_report_node, handle_blocker_node
)
from .trading_nodes import bull_bear_debate_node, mql5_execution_enforcer_node  # or INFO, WARN, ERROR …

import logging
logger = logging.getLogger(__name__)   # automatically uses the configured root logger
logger.info("Starting graph construction")


def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    has_calls = hasattr(last_message, "tool_calls") and last_message.tool_calls
    content_preview = str(getattr(last_message, "content", ""))[:200]
    
    logger.info(
        f"ROUTER: tool_calls={len(last_message.tool_calls) if has_calls else 0} "
        f"| content_len={len(str(getattr(last_message, 'content', '')))} "
        f"| preview={content_preview!r}"
    )
    
    if has_calls:
        slug = state.get("space_config", {}).get("slug", "")
        if slug == "trading-space":
            return "mql5_enforcer"
        return "execute_tool"
    return "evaluate_turn"


def route_after_evaluation(state: AgentState):
    eval_report = state.get("evaluation_report") or {}
    
    # 1. Stagnation Detection: check if we are stuck in a loop
    fingerprints = state.get("recent_actions_fingerprint") or []
    if len(fingerprints) >= 4:
        # Check if the last 4 tool calls are identical (meaning it keeps repeating)
        last_four = fingerprints[-4:]
        if len(set(last_four)) == 1:
            logger.warning("ROUTER: Stagnation detected. Routing to handle_blocker.")
            return "handle_blocker"
            
    # 2. Quality Degradation Check: last 3 quality scores show downward trend
    history = state.get("quality_history") or []
    if len(history) >= 3:
        last_three = history[-3:]
        if last_three[0] > last_three[1] > last_three[2]:
            logger.warning(f"ROUTER: Quality degradation detected: {last_three}. Routing to handle_blocker.")
            return "handle_blocker"
            
    # 3. Check if goal is achieved
    if eval_report.get("goal_achieved", False):
        return "final_report"
        
    # Else, continue reasoning
    return "guard"

def should_continue_verification(state: AgentState):
    """
    Route verification: execute tools if verification emitted them, otherwise proceed to guard.
    """
    last_message = state["messages"][-1] if state["messages"] else None
    if last_message and hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "execute_tool"
    return "guard"

def route_after_init(state: AgentState):
    """
    Route based on Codex Space type.
    """
    space_config = state.get("space_config", {})
    slug = space_config.get("slug", "")
    
    if slug == "trading-space":
        return "trading_debate"
    
    return "reason"

def after_validate(state: AgentState):
    """
    Route after validation: retry reasoning (via guard) or finish.
    If the validator detected fabrication (is_complete=False), re-enter
    through guard → reason for one retry. Otherwise, end.
    """
    if state.get("is_complete", True):
        return END
    return "guard"

def create_agent_graph():
    """
    Creates and compiles the agent graph.
    
    Graph topology:
      init → guard → reason → (tool calls?) → execute_tool → guard → reason → ...
                                   ↓ (no tool calls)
                               validate → (fabrication?) → guard → reason (max 1 retry)
                                   ↓ (clean)
                                  END
    """
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("init", init_node)
    workflow.add_node("guard", guard_node)
    workflow.add_node("reason", reason_node)
    workflow.add_node("execute_tool", execute_tool_node)
    workflow.add_node("validate", validate_response_node)
    workflow.add_node("verification", verification_node)
    workflow.add_node("trading_debate", bull_bear_debate_node)
    workflow.add_node("mql5_enforcer", mql5_execution_enforcer_node)
    workflow.add_node("evaluate_turn", evaluate_turn_node)
    workflow.add_node("final_report", final_report_node)
    workflow.add_node("handle_blocker", handle_blocker_node)
    
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
    
    # Add conditional edges out of reason
    workflow.add_conditional_edges(
        "reason",
        should_continue,
        {
            "mql5_enforcer": "mql5_enforcer",
            "execute_tool": "execute_tool",
            "evaluate_turn": "evaluate_turn"
        }
    )
    
    # Evaluate Turn → Final Report / Blocker / Guard
    workflow.add_conditional_edges(
        "evaluate_turn",
        route_after_evaluation,
        {
            "final_report": "final_report",
            "handle_blocker": "handle_blocker",
            "guard": "guard"
        }
    )
    
    workflow.add_edge("final_report", END)
    workflow.add_edge("handle_blocker", END)
    
    # Validator → END or retry via guard
    workflow.add_conditional_edges(
        "validate",
        after_validate,
        {
            "guard": "guard",
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
    workflow.add_edge("execute_tool", "verification")
    
    # Conditional edge from verification
    workflow.add_conditional_edges(
        "verification",
        should_continue_verification,
        {
            "execute_tool": "execute_tool",
            "guard": "guard"
        }
    )
    
    # Compile
    return workflow.compile()
