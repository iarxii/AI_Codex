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
