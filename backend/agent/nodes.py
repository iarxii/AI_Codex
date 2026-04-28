import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, ToolMessage, SystemMessage, BaseMessage
from langchain_core.runnables import RunnableConfig
from .state import AgentState
from .tools import get_agent_tools
from backend.config import settings
from backend.skills.registry import registry
from backend.integrations.ollamaopt_bridge import get_context_builder, get_retriever
from .profile import build_system_prompt

logger = logging.getLogger(__name__)

def log_performance(event: str, duration: float, metadata: dict = None):
    """
    Appends performance metrics to logs/performance_benchmark.log
    """
    log_file = Path("./logs/performance_benchmark.log")
    log_file.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    meta_str = f" | {metadata}" if metadata else ""
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {event}: {duration:.4f}s{meta_str}\n")

def get_dynamic_llm(config: RunnableConfig, bind_tools: bool = True):
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model")
    api_key = config.get("configurable", {}).get("api_key")
    
    if provider == "groq":
        from langchain_groq import ChatGroq
        llm = ChatGroq(model=model or "llama3-8b-8192", api_key=api_key, temperature=0, streaming=True)
    elif provider == "ollama_cloud":
        from langchain_openai import ChatOpenAI
        target_model = model or "llama3"
        base_url = config.get("configurable", {}).get("base_url") or "https://ollama.com"
        
        # Ensure /v1 suffix for OpenAI compatibility
        if not base_url.endswith("/v1"):
            base_url = f"{base_url.rstrip('/')}/v1"
            
        llm = ChatOpenAI(
            model=target_model, 
            base_url=base_url, 
            api_key=api_key or "sk-ollama", # Some proxies require a placeholder if no key
            temperature=0, 
            streaming=True
        )
    elif provider == "openrouter":
        from langchain_openai import ChatOpenAI
        target_model = model or "openrouter/free"
        llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            model=target_model,
            temperature=0,
            streaming=True,
            default_headers={
                "HTTP-Referer": "https://aicodex.ai",
                "X-Title": "AICodex Agentic IDE"
            }
        )
    elif provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        target_model = model or "gemini-1.5-flash"
        if target_model.startswith("models/"):
            target_model = target_model.replace("models/", "")
        
        llm = ChatGoogleGenerativeAI(
            model=target_model, 
            api_key=api_key, 
            temperature=0, 
            streaming=True
        )
    else:
        # local
        from langchain_openai import ChatOpenAI
        target_model = model or settings.DEFAULT_MODEL
        
        base_url = settings.OLLAMA_BASE_URL
        if not base_url.endswith("/v1"):
            base_url = f"{base_url.rstrip('/')}/v1"
            
        local_model = target_model if target_model and target_model != "local" else "default"
            
        llm = ChatOpenAI(
            model=local_model, 
            base_url=base_url, 
            api_key="sk-local",
            temperature=0, 
            streaming=True
        )
        
    if bind_tools:
        tools = get_agent_tools()
        return llm.bind_tools(tools)
    return llm

async def summarize_history(messages: List[BaseMessage], config: RunnableConfig) -> str:
    """
    Summarizes older messages to save context space.
    """
    if len(messages) < 10:
        return ""
    
    # We take messages between index 1 and -5 (keep system and last few)
    to_summarize = messages[1:-5]
    if not to_summarize:
        return ""
        
    llm = get_dynamic_llm(config, bind_tools=False)
    summary_prompt = "Summarize the key points of the preceding conversation history concisely. Focus on technical decisions and user goals."
    response = await llm.ainvoke([HumanMessage(content=f"{str(to_summarize)}\n\n{summary_prompt}")])
    return response.content

async def reason_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Main reasoning node. Serves as the 'Planner'. 
    Decides whether to respond directly or use tools.
    """
    messages = state["messages"]
    
    # Context Budgeting: If history is long, summarize older parts
    summary = ""
    if len(messages) > 15:
        summary = await summarize_history(messages, config)
        # Keep only the system message, the summary, and the last 5 messages
        system_msg = messages[0]
        recent_msgs = messages[-5:]
        messages = [system_msg, HumanMessage(content=f"Summary of previous turns: {summary}")] + recent_msgs

    system_prompt = build_system_prompt()
    
    # Use the dynamic LLM with tools bound
    llm = get_dynamic_llm(config, bind_tools=True)
    
    # First turn: check if it's just a greeting or simple request
    # To save tokens and latency, we don't do RAG here.
    # The agent can call 'codebase_search' if it needs more info.
    
    start_time = time.perf_counter()
    response = await llm.ainvoke(messages)
    duration = time.perf_counter() - start_time
    
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "default")
    log_performance("LLM_REASONING", duration, {"provider": provider, "model": model})
    
    tool_calls = getattr(response, "tool_calls", [])
    
    return {
        "messages": [response],
        "current_tool_calls": tool_calls,
        "context_data": {"history_len": len(messages), "summarized": bool(summary)}
    }

async def execute_tool_node(state: AgentState) -> Dict[str, Any]:
    """
    Tool execution node. Dispatches to the SkillRegistry.
    """
    last_message = state["messages"][-1]
    tool_messages = []
    
    if not hasattr(last_message, "tool_calls"):
        return {"messages": [], "current_tool_calls": []}

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_id = tool_call["id"]
        
        logger.info(f"Executing tool: {tool_name} with args: {tool_args}")
        
        start_time = time.perf_counter()
        skill = registry.get_skill(tool_name)
        if skill:
            try:
                result = await skill.execute(**tool_args)
                duration = time.perf_counter() - start_time
                log_performance("TOOL_CALL", duration, {"tool": tool_name})
                
                tool_result = result.output or result.error or "Success (no output)"
                if not result.success and not result.error:
                    tool_result = f"Error: {tool_result}"
            except Exception as e:
                tool_result = f"Exception during tool execution: {str(e)}"
        else:
            tool_result = f"Error: Tool '{tool_name}' not found in registry."
        
        tool_messages.append(
            ToolMessage(
                content=str(tool_result),
                tool_call_id=tool_id
            )
        )
        
    return {"messages": tool_messages, "current_tool_calls": []}
