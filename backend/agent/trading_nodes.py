import json
import asyncio
from typing import Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from backend.agent.state import AgentState
from backend.agent.models import get_llm

async def bull_bear_debate_node(state: AgentState) -> Dict[str, Any]:
    """
    Simulates a debate between a Bullish agent and a Bearish agent based on the user's query,
    before the main reasoning node synthesizes the final response.
    """
    messages = state["messages"]
    last_user_message = [m for m in messages if isinstance(m, HumanMessage)][-1].content
    
    # Initialize trading context if not present
    trading_context = state.get("trading_context") or {}
    
    # Extract provider/model config
    provider = state.get("space_config", {}).get("provider", "local")
    model = state.get("space_config", {}).get("model", "llama3")
    api_key = state.get("space_config", {}).get("api_key", "")
    
    # We use a fast model if available, but fallback to the current one
    llm = get_llm(provider, model, 0.7, api_key)
    
    bull_prompt = f"You are an aggressively bullish financial analyst. Argue why this asset or market situation is highly positive. Keep it under 100 words. User query: {last_user_message}"
    bear_prompt = f"You are a highly skeptical, bearish financial risk manager. Argue why this asset or market situation is extremely risky and negative. Keep it under 100 words. User query: {last_user_message}"
    
    # Run both simultaneously
    try:
        bull_res, bear_res = await asyncio.gather(
            llm.ainvoke([SystemMessage(content=bull_prompt)]),
            llm.ainvoke([SystemMessage(content=bear_prompt)])
        )
        bull_argument = bull_res.content
        bear_argument = bear_res.content
    except Exception as e:
        bull_argument = f"Bull perspective failed: {str(e)}"
        bear_argument = f"Bear perspective failed: {str(e)}"
    
    # Update trading context with the debate
    trading_context["bull_argument"] = bull_argument
    trading_context["bear_argument"] = bear_argument
    
    # Inject the debate summary into the conversation history
    debate_summary = (
        f"[TRADING DESK DEBATE GENERATED]\n"
        f"**Bull Analyst:** {bull_argument}\n"
        f"**Bear Risk Manager:** {bear_argument}\n"
        f"Please synthesize this debate and provide a balanced final recommendation to the user."
    )
    
    new_message = SystemMessage(content=debate_summary)
    
    # Return updated state
    return {
        "messages": [new_message],
        "trading_context": trading_context
    }

async def mql5_execution_enforcer_node(state: AgentState) -> Dict[str, Any]:
    """
    Middleware that intercepts tool execution. If a trading tool is called, it checks the internal risk ledger.
    Functions similarly to MQL5's OnTradeTransaction by providing a final hook before order transmission.
    """
    last_message = state["messages"][-1]
    trading_context = state.get("trading_context", {})
    space_config = state.get("space_config", {})
    
    # Dynamic risk limits: pull from space_config > trading_context > default
    daily_drawdown = trading_context.get("daily_drawdown_percent", 0.0)
    max_drawdown = (
        space_config.get("max_daily_drawdown_percent")
        or trading_context.get("max_drawdown_percent")
        or 3.0  # Sensible default if neither source provides a value
    )
    gate_locked = daily_drawdown >= max_drawdown
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        vetoed_calls = []
        for call in last_message.tool_calls:
            # If the tool is trade execution, intercept it
            if call["name"] in ["execute_trade", "mt5_dispatch_signal"]:
                if gate_locked:
                    vetoed_calls.append({
                        "name": call["name"],
                        "reason": f"TRADE VETOED: Daily drawdown limit ({max_drawdown}%) exceeded. Current: {daily_drawdown}%."
                    })
        
        # If vetoed, we might want to return an error or inject a system message overriding the tool
        if vetoed_calls:
            veto_msg = (
                f"[MQL5 ENFORCER NODE VETO]\n"
                f"The following executions were blocked by the central risk ledger:\n"
                f"{json.dumps(vetoed_calls, indent=2)}\n"
                f"Agent must inform the user that the Trading Gate is locked."
            )
            # Override tool calls by returning a system message to stop actual execution
            # Or we can just let `execute_tool` handle the veto. For strict middleware, we override here.
            return {
                "error": "MQL5_GATE_LOCKED",
                "messages": [SystemMessage(content=veto_msg)]
            }
            
    return state
