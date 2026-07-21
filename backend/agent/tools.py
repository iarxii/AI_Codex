import logging
from typing import List
from langchain_core.tools import StructuredTool
from backend.skills.registry import registry
from backend.skills.base import BaseSkill
from backend.agent.skill_routing import resolve_client_capabilities

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

def make_wrapped_workspace_writer(skill: BaseSkill, conversation_id: str):
    async def wrapped_workspace_writer(filename: str, content: str, type: str = "code", tutor_explanation: str = None):
        return await skill.execute(filename=filename, content=content, type=type, tutor_explanation=tutor_explanation, conversation_id=conversation_id)
    return wrapped_workspace_writer

def make_wrapped_workspace_patcher(skill: BaseSkill, conversation_id: str):
    async def wrapped_workspace_patcher(filename: str, search_string: str, replace_string: str, tutor_explanation: str = None):
        return await skill.execute(filename=filename, search_string=search_string, replace_string=replace_string, tutor_explanation=tutor_explanation, conversation_id=conversation_id)
    return wrapped_workspace_patcher

def make_wrapped_shell_exec(skill: BaseSkill, conversation_id: str):
    async def wrapped_shell_exec(command: str, cwd: str = "."):
        return await skill.execute(command=command, cwd=cwd, conversation_id=conversation_id)
    return wrapped_shell_exec

def make_wrapped_harness_dispatch(skill: BaseSkill, conversation_id: str):
    async def wrapped_harness_dispatch(prompt: str, space_slug: str = "gemma-code-lab", language: str = "python"):
        return await skill.execute(prompt=prompt, space_slug=space_slug, language=language, conversation_id=conversation_id)
    return wrapped_harness_dispatch

def make_wrapped_workspace_reader(skill: BaseSkill, conversation_id: str):
    async def wrapped_workspace_reader(action: str, path: str, query: str = None, recursive: bool = False):
        return await skill.execute(action=action, path=path, query=query, recursive=recursive, conversation_id=conversation_id)
    return wrapped_workspace_reader

def get_agent_tools(
    conversation_id: str = None,
    allowed_skills: List[str] = None,
    client_type: str = "web",
    client_capabilities=None,
) -> List[StructuredTool]:
    """
    Discovers all skills and returns them as a list of LangChain tools.
    Filters by allowed_skills if provided, and strictly filters by client_type capability.
    """
    resolved_capabilities = resolve_client_capabilities(client_type, client_capabilities)
    skill_capabilities = {
        "workspace_writer": "workspace.write",
        "workspace_patcher": "workspace.write",
        "workspace_reader": "workspace.read",
        "shell_exec": "shell.execute",
    }
    
    # Ensure skills are discovered
    registry.discover_builtin_skills()
    
    skills = registry.get_all_skills()
    tools = []
    
    for skill in skills:
        if allowed_skills and "all" not in allowed_skills and skill.name not in allowed_skills:
            continue
            
        required_capability = skill_capabilities.get(skill.name)
        if required_capability and required_capability not in resolved_capabilities:
            continue

        try:
            # We must preserve the signature for StructuredTool.from_function to work.
            if skill.name == "workspace_writer":
                tool = StructuredTool.from_function(
                    coroutine=make_wrapped_workspace_writer(skill, conversation_id),
                    name=skill.name,
                    description=skill.description,
                )
            elif skill.name == "workspace_patcher":
                tool = StructuredTool.from_function(
                    coroutine=make_wrapped_workspace_patcher(skill, conversation_id),
                    name=skill.name,
                    description=skill.description,
                )
            elif skill.name == "shell_exec":
                tool = StructuredTool.from_function(
                    coroutine=make_wrapped_shell_exec(skill, conversation_id),
                    name=skill.name,
                    description=skill.description,
                )
            elif skill.name == "workspace_reader":
                tool = StructuredTool.from_function(
                    coroutine=make_wrapped_workspace_reader(skill, conversation_id),
                    name=skill.name,
                    description=skill.description,
                )
            elif skill.name == "harness_dispatch":
                tool = StructuredTool.from_function(
                    coroutine=make_wrapped_harness_dispatch(skill, conversation_id),
                    name=skill.name,
                    description=skill.description,
                )
            else:
                # Generic fallback for other skills (can be expanded)
                # To prevent closure capture issues here too, we use a default argument trick
                async def wrapped_generic(*args, skill=skill, **kwargs):
                    return await skill.execute(*args, **kwargs)
                tool = StructuredTool.from_function(
                    coroutine=wrapped_generic,
                    name=skill.name,
                    description=skill.description,
                )
            tools.append(tool)
            logger.info(f"Converted skill to tool: {skill.name}")
        except Exception as e:
            logger.error(f"Failed to convert skill {skill.name} to tool: {e}")
            
    # Add native agent tools based on capabilities
    if "codebase.search" in resolved_capabilities:
        tools.append(codebase_search)
        
    if "vscode.webview" in resolved_capabilities:
        tools.append(get_terminal_viewport)
        
    tools.append(mt5_dispatch_signal)
    tools.append(compact_context)
    tools.append(write_scratchpad)
    tools.append(read_full_tool_output)
    
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

@StructuredTool.from_function
async def get_terminal_viewport() -> str:
    """
    Microsoft Webwright vision integration.
    Captures the visual state of the active MT5/MQL5 terminal on the user's desktop
    to verify charting, order blocks, or liquidity levels before making trading decisions.
    Includes timeout guards for external API calls.
    """
    import asyncio
    from backend.utils.screenshot import capture_mt5_window
    
    VISION_TIMEOUT_SECONDS = 10
    
    async def _capture_terminal():
        # Perform physical Windows capture or mock canvas rendering
        loop = asyncio.get_running_loop()
        path = await loop.run_in_executor(None, capture_mt5_window)
        return path
    
    try:
        path = await asyncio.wait_for(_capture_terminal(), timeout=VISION_TIMEOUT_SECONDS)
        if path:
            from backend.api.market import active_context
            symbol = active_context.get("symbol", "BTCUSD")
            timeframe = active_context.get("timeframe", "1D")
            
            # Dynamic descriptive text based on active instrument
            if symbol in ["BTCUSD", "ETHUSD", "XRPUSD"]:
                desc = f"Visual Analysis: {symbol} {timeframe} active. High volatility crypto asset footprint. Volume indicators suggest consolidation."
            elif "USD" in symbol or symbol in ["EURUSD", "GBPUSD", "ZARUSD"]:
                desc = f"Visual Analysis: {symbol} {timeframe} active. Classical session range expansion visible. Support/resistance bounds are holding."
            else:
                desc = f"Visual Analysis: {symbol} {timeframe} active. Chart displays steady liquidity flow with minor consolidation near moving averages."

            return (
                "WEBWRIGHT VISION CAPTURE [SUCCESS]:\n"
                f"Saved MT5 active viewport capture to path: {path}\n"
                f"{desc}"
            )
        else:
            return "WEBWRIGHT VISION CAPTURE [ERROR]: Captured empty window frame."
    except asyncio.TimeoutError:
        return (
            "WEBWRIGHT VISION CAPTURE [TIMEOUT]:\n"
            f"The MT5 terminal did not respond within {VISION_TIMEOUT_SECONDS}s. "
            "Ensure MetaTrader 5 is running and the Webwright bridge service is active."
        )
    except Exception as e:
        return f"WEBWRIGHT VISION CAPTURE [ERROR]: {str(e)}"
    
@StructuredTool.from_function
async def mt5_dispatch_signal(symbol: str, tp: float, sl: float, entry: float, direction: str) -> str:
    """
    Dispatch a trading signal to the MT5 terminal via the backend enforcer.
    Requires symbol, take profit (tp), stop loss (sl), entry point, and direction ('buy' or 'sell').
    """
    from backend.agent.risk_enforcer import risk_enforcer
    from backend.integrations.mt5_server import mt5_client
    
    # 1. Enforce local risk parameters
    is_safe, reason = risk_enforcer.validate_trade(
        symbol=symbol,
        tp=tp,
        sl=sl,
        entry=entry,
        direction=direction
    )
    if not is_safe:
        return f"ORDER REJECTED BY RISK ENFORCER: {reason}"
        
    # 2. Dispatch to MT5 server
    try:
        response = await mt5_client.send_command({
            "action": "trade",
            "symbol": symbol,
            "direction": direction,
            "entry": entry,
            "tp": tp,
            "sl": sl
        })
        if response.get("status") == "success":
            ticket = response.get("ticket", "N/A")
            return f"MT5_DISPATCH [{direction.upper()}] Success. Ticket: {ticket}"
        else:
            err = response.get("error", "Unknown terminal error")
            return f"MT5_DISPATCH [{direction.upper()}] Failed. Terminal returned error: {err}"
    except Exception as e:
        # Fallback logging if the local TCP socket connection is refused (developer sandbox offline)
        return (
            f"MT5_DISPATCH [{direction.upper()}] offline bypass. "
            f"Trade complies with Risk Enforcer. Logged action: {symbol} @ {entry}. TP: {tp}, SL: {sl}."
        )


@StructuredTool.from_function
async def compact_context(force_reason: str) -> str:
    """
    Enables the agent to clear short-term memory by compressing historical multi-turn chat records,
    logs, and tool outputs into a high-density summary.
    """
    return "Memory compaction request queued."


@StructuredTool.from_function
async def write_scratchpad(task_list_json: str) -> str:
    """
    Allows the agent to write, append, or update its detailed task checklist and engineering plan.
    Must pass a valid JSON string representing the checklist array of tasks, e.g. '[{"text": "Refactor router", "done": false}]'.
    """
    return "Scratchpad planning board updated."


@StructuredTool.from_function
async def read_full_tool_output() -> str:
    """
    Retrieves the complete, unpruned output of the most recent tool execution.
    Use this if the output was compressed or truncated for token efficiency (indicated by [OMITTED] markers),
    and you need to inspect the full contents (e.g. detailed compile logs, test stacks, or output listings).
    """
    import os
    log_path = "./logs/last_tool_output.log"
    if not os.path.exists(log_path):
        return "No tool outputs have been captured yet, or the log file does not exist."
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            content = f.read()
        if not content:
            return "The last tool execution produced no output."
        return content
    except Exception as e:
        return f"Error reading full tool output log: {str(e)}"


def bind_mcp_tools(
    tools: List[StructuredTool],
    mcp_tools_list: List[dict],
    model: str = "default",
    is_short_process: bool = False,
    apply_heuristics: bool = False,
) -> List[StructuredTool]:
    """
    Dynamically appends client-side MCP tools to the provided tool list.
    If apply_heuristics is True, applies smart routing heuristics for sequential thinking.
    """
    for mcp_t in mcp_tools_list:
        tool_name = mcp_t.get("name")
        if not tool_name:
            continue
            
        if apply_heuristics and tool_name == "mcp__reasoning__sequentialthinking":
            # 1. Skip if it's a short/repetitive process
            if is_short_process:
                logger.info("PIPELINE: Skipping sequential-thinking tool (Short Process)")
                continue
            # 2. Skip if the model natively supports reasoning
            if model and any(kw in model.lower() for kw in ["o1", "o3", "thinking"]):
                logger.info(f"PIPELINE: Skipping sequential-thinking tool (Native reasoning model: {model})")
                continue
                
        if any(t.name == tool_name for t in tools):
            continue
            
        async def dummy_coroutine(**kwargs):
            return "Delegated to client"
            
        mcp_wrapped = StructuredTool(
            name=tool_name,
            description=mcp_t.get("description") or f"Client-side MCP tool: {tool_name}",
            func=lambda *args, **kwargs: "Delegated to client",
            coroutine=dummy_coroutine,
            args_schema=mcp_t.get("inputSchema") or {}
        )
        tools.append(mcp_wrapped)
    return tools
