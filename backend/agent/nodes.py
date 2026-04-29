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
from .local_client import NativeLocalClient

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

async def get_dynamic_llm(config: RunnableConfig, bind_tools: bool = True):
    """
    Retrieves and configures the LLM provider based on the provided configuration.
    Includes robustness fixes for tool binding and connection failures.
    """
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model")
    api_key = config.get("configurable", {}).get("api_key")
    
    # Debug logging for model initialization
    print(f"DEBUG: Initializing LLM Provider: {provider} | Model: {model}")

    try:
        if provider == "groq":
            from langchain_groq import ChatGroq
            llm = ChatGroq(model=model or "llama3-8b-8192", api_key=api_key, temperature=0, streaming=True)
        elif provider == "ollama_cloud":
            from langchain_openai import ChatOpenAI
            target_model = model or "llama3"
            base_url = config.get("configurable", {}).get("base_url") or "https://ollama.com"
            if not base_url.endswith("/v1"):
                base_url = f"{base_url.rstrip('/')}/v1"
            llm = ChatOpenAI(model=target_model, base_url=base_url, api_key=api_key or "sk-ollama", temperature=0, streaming=True)
        elif provider == "openrouter":
            from langchain_openai import ChatOpenAI
            target_model = model or "openrouter/free"
            llm = ChatOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
                model=target_model,
                temperature=0,
                streaming=True,
                default_headers={"HTTP-Referer": "https://aicodex.ai", "X-Title": "AICodex Agentic IDE"}
            )
        elif provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            target_model = model or "gemini-1.5-flash"
            if target_model.startswith("models/"):
                target_model = target_model.replace("models/", "")
            llm = ChatGoogleGenerativeAI(model=target_model, api_key=api_key, temperature=0, streaming=True)
        else:
            # Local provider (llama-server.exe or Ollama)
            from langchain_openai import ChatOpenAI
            target_model = model or settings.DEFAULT_MODEL
            base_url = settings.OLLAMA_BASE_URL
            
            # Note: llama-server.exe (turboquant) is often OpenAI compatible at the root or /v1
            if not base_url.endswith("/v1"):
                base_url = f"{base_url.rstrip('/')}/v1"
            
            # Normalize model name: SHA256 blob digests from llama-server's /api/tags
            # are not valid model names for /v1/chat/completions — use "default"
            local_model = target_model if target_model and target_model != "local" else "default"
            if local_model.startswith("sha256-") or local_model.startswith("sha256:"):
                print(f"DEBUG: Detected blob digest model name '{local_model[:20]}...', normalizing to 'default'")
                local_model = "default"
                
            print(f"DEBUG: Local Neural Core at {base_url} (Model: {local_model})")
            
            # Pre-flight connection check — fail fast with a clear error
            import httpx
            try:
                probe_url = base_url.replace("/v1", "")
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(f"{probe_url}/api/tags")
                    if resp.status_code != 200:
                        # Try /v1/models as fallback (pure OpenAI-compat servers)
                        resp2 = await client.get(f"{base_url}/models")
                        if resp2.status_code != 200:
                            raise ConnectionError(f"Local LLM server at {probe_url} returned status {resp.status_code}")
            except (httpx.ConnectError, httpx.RequestError):
                raise ConnectionError(f"Cannot reach local LLM server at {base_url}. Is Ollama or llama-server running?")
            except httpx.TimeoutException:
                raise ConnectionError(f"Local LLM server at {base_url} timed out. The server may be overloaded.")
                
            # Use NativeLocalClient for local for better stability and caching
            return NativeLocalClient(
                base_url=base_url, 
                model=local_model, 
                temperature=0.0
            )
            
        if bind_tools:
            # Skip tool binding for local/ollama_cloud providers:
            # llama-server (turboquant) doesn't support OpenAI-compatible function calling.
            # The tools parameter causes the streaming response parser to hang waiting for 
            # structured tool_calls chunks that never arrive in the expected format.
            if provider in ("local", "ollama_cloud"):
                print(f"DEBUG: Skipping tool binding for provider '{provider}' (not supported by llama-server)")
                return llm
            try:
                tools = get_agent_tools()
                # Try to bind tools, but catch if the model/provider doesn't support it
                return llm.bind_tools(tools)
            except Exception as e:
                print(f"WARNING: Provider {provider} does not support tool binding: {e}. Proceeding with plain LLM.")
                return llm
        return llm

    except Exception as e:
        print(f"ERROR: Failed to initialize LLM for provider {provider}: {e}")
        raise e

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
        
    llm = await get_dynamic_llm(config, bind_tools=False)
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
    
    # Initialize context builder with provider-aware budget
    provider = config.get("configurable", {}).get("provider", "local")
    
    # Early Auth Check for Cloud
    if provider == "ollama_cloud":
        api_key = config.get("configurable", {}).get("api_key")
        if not api_key or api_key == "sk-ollama":
            from langchain_core.messages import AIMessage
            return {
                "messages": [AIMessage(content="❌ **Ollama Cloud API Key Missing**\nPlease open the **Settings** (gear icon) and add your remote API key to enable Cloud Neural core.")],
                "current_tool_calls": [],
                "context_data": {"error": "auth_missing"}
            }

    print(f"PIPELINE: Building context for provider={provider}...")
    context_builder = get_context_builder(provider=provider)
    
    # Wire the budget! 
    # This transforms the raw message list into a budget-aware prompt
    messages = context_builder.build_context(messages)
    
    print(f"PIPELINE: Context built (len={len(messages)}). Initializing LLM...")
    
    # Use the dynamic LLM with tools bound
    try:
        llm = await get_dynamic_llm(config, bind_tools=True)
    except Exception as init_err:
        print(f"PIPELINE ERROR: LLM init failed — {init_err}")
        from langchain_core.messages import AIMessage
        return {
            "messages": [AIMessage(content=f"❌ LLM initialization failed: {init_err}")],
            "current_tool_calls": [],
            "context_data": {"error": str(init_err)}
        }
    
    # Increase timeout for local providers to handle high-load prefilling
    request_timeout = 120.0 if provider == "local" else 60.0
    
    start_time = time.perf_counter()
    print(f"PIPELINE: Invoking LLM (timeout={request_timeout}s)...")
    
    # For local providers: use native streaming via callback for instant UI feedback
    token_callback = config.get("configurable", {}).get("token_callback")
    
    try:
        import asyncio as _asyncio
        
        if provider == "local" and isinstance(llm, NativeLocalClient) and token_callback:
            # STREAMING PATH: Push tokens to WebSocket as they arrive
            full_content = ""
            async for chunk in llm.astream(messages):
                token = chunk.get("content", "")
                full_content += token
                print(token, end="", flush=True)  # Terminal monitoring
                await token_callback(full_content)  # Push to WebSocket
            
            from langchain_core.messages import AIMessage as _AIMsg
            response = _AIMsg(content=full_content)
        else:
            # STANDARD PATH: LangChain providers with native streaming support
            response = await _asyncio.wait_for(llm.ainvoke(messages), timeout=request_timeout)
            
    except (TimeoutError, Exception) as invoke_err:
        is_timeout = isinstance(invoke_err, (_asyncio.TimeoutError, TimeoutError)) or "TimeoutError" in type(invoke_err).__name__
        if is_timeout:
            print(f"PIPELINE ERROR: LLM call timed out after {request_timeout}s")
            error_msg = f"Request timed out after {request_timeout}s. The model server may be overloaded or prefilling context. Please try again."
        else:
            print(f"PIPELINE ERROR: LLM invocation failed — {invoke_err}")
            error_msg = str(invoke_err)
            # Parse common API errors
            if "429" in error_msg:
                error_msg = "Rate limited by provider. Please wait and retry, or switch models."
            elif "401" in error_msg or "API key" in error_msg or "unauthorized" in error_msg.lower():
                error_msg = f"Authentication failed for {provider}. Please check your API key in Settings."
            elif "Could not find model" in error_msg or "404" in error_msg:
                error_msg = "Model not found. Please select a different model."
        from langchain_core.messages import AIMessage
        return {
            "messages": [AIMessage(content=f"❌ {error_msg}")],
            "current_tool_calls": [],
            "context_data": {"error": str(invoke_err)}
        }
    duration = time.perf_counter() - start_time
    
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "default")
    log_performance("LLM_REASONING", duration, {"provider": provider, "model": model})
    print(f"\nPIPELINE: LLM responded in {duration:.2f}s, content length={len(str(response.content))}")
    
    tool_calls = getattr(response, "tool_calls", [])
    print(f"PIPELINE: Tool calls: {len(tool_calls)}")
    
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
