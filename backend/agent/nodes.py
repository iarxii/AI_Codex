import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, ToolMessage, SystemMessage, BaseMessage, AIMessage
from langchain_core.runnables import RunnableConfig
from .state import AgentState
from .tools import get_agent_tools
from backend.config import settings
from backend.skills.registry import registry
from backend.integrations.ollamaopt_bridge import get_context_builder, get_retriever
from .profile import build_system_prompt
from .local_client import NativeLocalClient, detect_template

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
    
    Local provider supports two backend modes:
      - 'ollama': Uses Ollama App's OpenAI-compatible API (auto-templating)
      - 'llamacpp': Uses raw llama-server with NativeLocalClient (manual templates)
    """
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model")
    api_key = config.get("configurable", {}).get("api_key")
    agent_mode = config.get("configurable", {}).get("agent_mode", True)
    
    if not agent_mode:
        bind_tools = False

    # Debug logging for model initialization
    logger.debug(f"DEBUG: Initializing LLM Provider: {provider} | Model: {model} | Agent Mode: {agent_mode}")

    model_config = config.get("configurable", {}).get("model_config", {})
    temp = model_config.get("temperature", 0.0)
    max_toks = model_config.get("max_tokens", 1024)

    try:
        if provider == "colab_bridge":
            from codex_spaces.backend.agent.bridge_llm import ChatBridge
            user_id = config.get("configurable", {}).get("user_id")
            space_slug = config.get("configurable", {}).get("space_slug")
            if not user_id or not space_slug:
                raise ValueError("Colab bridge requires 'user_id' and 'space_slug' in configuration.")
            llm = ChatBridge(user_id=int(user_id), space_slug=str(space_slug), model_name=model or "default")
        elif provider == "groq":
            from langchain_groq import ChatGroq
            llm = ChatGroq(model=model or "llama3-8b-8192", api_key=api_key, temperature=temp, max_tokens=max_toks, streaming=True)
        elif provider == "ollama_cloud":
            from langchain_openai import ChatOpenAI
            target_model = model or "llama3"
            base_url = config.get("configurable", {}).get("base_url") or "https://ollama.com"
            if not base_url.endswith("/v1"):
                base_url = f"{base_url.rstrip('/')}/v1"
            llm = ChatOpenAI(model=target_model, base_url=base_url, api_key=api_key or "sk-ollama", temperature=temp, max_tokens=max_toks, streaming=True)
        elif provider == "openrouter":
            from langchain_openai import ChatOpenAI
            target_model = model or "openrouter/free"
            llm = ChatOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
                model=target_model,
                temperature=temp,
                max_tokens=max_toks,
                streaming=True,
                default_headers={"HTTP-Referer": "https://aicodex.ai", "X-Title": "AICodex Agentic IDE"}
            )
        elif provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            target_model = model or "gemini-1.5-flash"
            if target_model.startswith("models/"):
                target_model = target_model.replace("models/", "")
            llm = ChatGoogleGenerativeAI(model=target_model, api_key=api_key, temperature=temp, max_output_tokens=max_toks, streaming=True)
        else:
            # ─── Local Provider: Ollama App or raw llama-server ───
            local_backend_mode = config.get("configurable", {}).get(
                "local_backend_mode", settings.LOCAL_BACKEND_MODE
            )
            target_model = model or settings.DEFAULT_MODEL
            
            # Normalize model name: SHA256 blob digests are not valid model names
            local_model = target_model if target_model and target_model != "local" else "default"
            if local_model.startswith("sha256-") or local_model.startswith("sha256:"):
                logger.debug(f"DEBUG: Detected blob digest model name '{local_model[:20]}...', normalizing to 'default'")
                local_model = "default"
            
            if local_backend_mode == "ollama":
                # ── OLLAMA MODE ──
                # Ollama handles chat templates automatically via its Modelfile.
                # We use LangChain's ChatOpenAI against Ollama's OpenAI-compat API.
                from langchain_openai import ChatOpenAI
                base_url = settings.OLLAMA_BASE_URL
                if not base_url.endswith("/v1"):
                    base_url = f"{base_url.rstrip('/')}/v1"
                
                logger.debug(f"DEBUG: Local [Ollama mode] at {base_url} (Model: {local_model})")
                
                # Pre-flight connection check
                import httpx
                try:
                    probe_url = settings.OLLAMA_BASE_URL.rstrip("/")
                    async with httpx.AsyncClient(timeout=3.0) as client:
                        resp = await client.get(f"{probe_url}/api/tags")
                        if resp.status_code != 200:
                            raise ConnectionError(
                                f"Ollama server at {probe_url} returned status {resp.status_code}"
                            )
                except (httpx.ConnectError, httpx.RequestError):
                    raise ConnectionError(
                        f"Cannot reach Ollama at {settings.OLLAMA_BASE_URL}. "
                        "Is the Ollama App running?"
                    )
                except httpx.TimeoutException:
                    raise ConnectionError(
                        f"Ollama at {settings.OLLAMA_BASE_URL} timed out. "
                        "The server may be overloaded."
                    )
                
                llm = ChatOpenAI(
                    model=local_model,
                    base_url=base_url,
                    api_key="ollama",  # Ollama doesn't need a real key
                    temperature=temp,
                    max_tokens=max_toks,
                    streaming=True,
                )
                # Ollama mode returns a standard ChatOpenAI instance —
                # tool binding and streaming are handled by LangChain natively
                
            else:
                # ── LLAMACPP MODE ──
                # Direct connection to llama-server.exe with manual chat templates.
                # Uses NativeLocalClient which auto-detects the template from model name.
                base_url = settings.LLAMACPP_BASE_URL
                if not base_url.endswith("/v1"):
                    base_url = f"{base_url.rstrip('/')}/v1"
                
                detected_template = detect_template(local_model)
                logger.debug(
                    f"DEBUG: Local [llamacpp mode] at {base_url} "
                    f"(Model: {local_model}, Template: {detected_template})"
                )
                
                # Pre-flight connection check
                import httpx
                try:
                    probe_url = base_url.replace("/v1", "")
                    async with httpx.AsyncClient(timeout=3.0) as client:
                        # llama-server doesn't have /api/tags, try /v1/models
                        resp = await client.get(f"{base_url}/models")
                        if resp.status_code != 200:
                            # Try the root health endpoint
                            resp2 = await client.get(f"{probe_url}/health")
                            if resp2.status_code != 200:
                                raise ConnectionError(
                                    f"llama-server at {probe_url} returned status {resp.status_code}"
                                )
                except (httpx.ConnectError, httpx.RequestError):
                    raise ConnectionError(
                        f"Cannot reach llama-server at {settings.LLAMACPP_BASE_URL}. "
                        "Is llama-server.exe running?"
                    )
                except httpx.TimeoutException:
                    raise ConnectionError(
                        f"llama-server at {settings.LLAMACPP_BASE_URL} timed out. "
                        "The server may be overloaded."
                    )
                
                return NativeLocalClient(
                    base_url=base_url,
                    model=local_model,
                    temperature=temp,
                    template=detected_template,
                )
            
        if bind_tools:
            # Skip tool binding for local NativeLocalClient:
            # llama-server (turboquant) doesn't support OpenAI-compatible function calling.
            if provider == "local" and isinstance(llm, NativeLocalClient):
                logger.debug(f"DEBUG: Skipping tool binding for provider '{provider}' (not supported by native client)")
                return llm
            try:
                conv_id = config.get("configurable", {}).get("conversation_id")
                tools = get_agent_tools(conversation_id=conv_id)
                # Try to bind tools, but catch if the model/provider doesn't support it
                return llm.bind_tools(tools)
            except Exception as e:
                logger.warning(f"WARNING: Provider {provider} does not support tool binding: {e}. Proceeding with plain LLM.")
                return llm
        return llm

    except Exception as e:
        print(f"ERROR: Failed to initialize LLM for provider {provider}: {e}")
        raise e

async def init_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Tier 1 & 2: Metadata Handshake and "Canary" Probes.
    Verifies model health and capabilities before reasoning.
    """
    start_time = time.perf_counter()
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "default")
    
    # Telemetry initialization (if not already done by chat.py)
    telemetry = state.get("telemetry", {
        "ttft": 0, "total_tokens": 0, "usage": {"input": 0, "output": 0},
        "latencies": {}, "capabilities": [], "provider": provider, "model": model
    })
    
    # Tier 1: Metadata Handshake
    from backend.utils.telemetry import get_model_capabilities
    telemetry["capabilities"] = get_model_capabilities(provider, model)
    
    # Tier 2: Latency Benchmark (Initial probe)
    # For now, we'll just mark the init node duration
    telemetry["latencies"]["init_node"] = time.perf_counter() - start_time
    
    return {"telemetry": telemetry}

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
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "default")
    
    # Workspace Sentinel: update status file periodically
    from backend.agent.workspace_sentinel import (
        should_update_status, extract_status_from_history, write_workspace_status
    )
    turn_count = len([m for m in messages if m.type == "human"])
    if should_update_status(turn_count):
        status = extract_status_from_history(messages)
        if status:
            conversation_id = config.get("configurable", {}).get("conversation_id", "default")
            write_workspace_status(conversation_id, status)
            logger.info(f"SENTINEL: Status updated at turn {turn_count} ({len(status)} chars)")
    
    # Context Budgeting: If history is long, summarize older parts
    summary = ""
    if len(messages) > 15:
        summary = await summarize_history(messages, config)
        # Keep only the system message, the summary, and the last 5 messages
        system_msg = messages[0]
        recent_msgs = messages[-5:]
        messages = [system_msg, HumanMessage(content=f"Summary of previous turns: {summary}")] + recent_msgs
    conversation_id = config.get("configurable", {}).get("conversation_id", "default")
    system_prompt = build_system_prompt(conversation_id)
    
    space_config = state.get("space_config", {})
    if space_config.get("system_prompt_prefix"):
        system_prompt = f"{space_config['system_prompt_prefix']}\n\n{system_prompt}"

    # Initialize context builder with provider-aware budget
    provider = config.get("configurable", {}).get("provider", "local")
    
    # Early Auth Check for Cloud Providers
    if provider in ["groq", "openrouter", "gemini", "ollama_cloud"]:
        api_key = config.get("configurable", {}).get("api_key")
        
        is_missing = not api_key or (provider == "ollama_cloud" and api_key == "sk-ollama")
        if is_missing:
            p_label = provider.capitalize() if provider != "ollama_cloud" else "Ollama Cloud"
            return {
                "messages": [AIMessage(content=f"❌ **{p_label} API Key Missing**\nPlease open the **Settings** (gear icon) and add your API key for {p_label} to enable this Neural core.")],
                "current_tool_calls": [],
                "context_data": {"error": "auth_missing"}
            }

    logger.info(f"PIPELINE: Building context for provider={provider}...")
    context_builder = get_context_builder(provider=provider)
    
    # Wire the budget! 
    # This transforms the raw message list into a budget-aware prompt
    messages = context_builder.build_context(messages, system_prompt=system_prompt)
    
    logger.info(f"PIPELINE: Context built (len={len(messages)}). Initializing LLM...")
    
    # Initialize tools and binding logic
    conversation_id = config.get("configurable", {}).get("conversation_id")
    allowed_skills = space_config.get("skills", ["all"])
    tools = get_agent_tools(conversation_id, allowed_skills)
    
    # Use the dynamic LLM with tools bound
    try:
        # get_dynamic_llm is defined in this file
        llm = await get_dynamic_llm(config, bind_tools=False) 
        
        # Sanity check tools before binding
        valid_tools = []
        for t in tools:
            if not getattr(t, "name", None):
                logger.warning(f"PIPELINE WARNING: Found tool without name, skipping: {t}")
                continue
            valid_tools.append(t)
            
        # Proactive check: only bind tools if model claims support in telemetry
        capabilities = state.get("telemetry", {}).get("capabilities", [])
        has_tool_support = "Tools" in capabilities
        
        if valid_tools and has_tool_support and not isinstance(llm, NativeLocalClient):
            logger.info(f"PIPELINE: Binding {len(valid_tools)} tools to LLM (Model: {model})")
            llm = llm.bind_tools(valid_tools)
        elif valid_tools:
            logger.info(f"PIPELINE: Skipping tool binding for '{model}' (Capability 'Tools' not found in {capabilities})")
    except Exception as init_err:
        logger.error(f"PIPELINE ERROR: LLM init failed — {init_err}")
        return {
            "messages": [AIMessage(content=f"❌ LLM initialization failed: {init_err}")],
            "current_tool_calls": [],
            "context_data": {"error": str(init_err)}
        }
    
    # Base timeout: local and ollama_cloud are typically heavier on prefill latency
    base_timeout = 120.0 if provider in ("local", "ollama_cloud") else 60.0
    
    # Dynamically scale timeout based on context complexity (tool executions)
    from langchain_core.messages import ToolMessage
    original_messages = state.get("messages", [])
    tool_turns = sum(1 for m in original_messages if getattr(m, "type", "") == "tool" or isinstance(m, ToolMessage))
    request_timeout = base_timeout + (tool_turns * 30.0)
    start_time = time.perf_counter()
    logger.info(f"PIPELINE: Invoking LLM (timeout={request_timeout}s)...")
    
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
                logger.debug(token)  # Terminal monitoring
                await token_callback(full_content)  # Push to WebSocket
            
            response = AIMessage(content=full_content)
        else:
            # STANDARD PATH: LangChain providers with native streaming support
            response = await _asyncio.wait_for(llm.ainvoke(messages), timeout=request_timeout)
            
    except (TimeoutError, Exception) as invoke_err:
        error_msg = str(invoke_err)
        
        # ─── ROBUST FALLBACK ───
        # If the model provider rejects the request because of tool calling,
        # we retry WITHOUT tool binding to allow the model to still reply.
        is_tool_error = "does not support tools" in error_msg or "invalid_request_error" in error_msg
        if is_tool_error and "valid_tools" in locals() and valid_tools:
            logger.warning(f"PIPELINE WARNING: Tool-calling error caught: {error_msg}. Retrying without tools...")
            try:
                # Re-initialize LLM without any tool binding
                llm_fallback = await get_dynamic_llm(config, bind_tools=False)
                response = await _asyncio.wait_for(llm_fallback.ainvoke(messages), timeout=request_timeout)
                # Success! Override error_msg and continue
                invoke_err = None 
            except Exception as retry_err:
                logger.error(f"PIPELINE ERROR: Fallback retry also failed: {retry_err}")
                error_msg = f"Model failed with tool calling, and fallback also failed: {retry_err}"
        
        if invoke_err:
            is_timeout = isinstance(invoke_err, (_asyncio.TimeoutError, TimeoutError)) or "TimeoutError" in type(invoke_err).__name__
            if is_timeout:
                logger.error(f"PIPELINE ERROR: LLM call timed out after {request_timeout}s")
                error_msg = f"Request timed out after {request_timeout}s. The model server may be overloaded or prefilling context. Please try again."
            else:
                logger.error(f"PIPELINE ERROR: LLM invocation failed — {invoke_err}")
                if not error_msg or error_msg == str(invoke_err):
                    error_msg = str(invoke_err)
                # Parse common API errors
                if "429" in error_msg:
                    error_msg = "Rate limited by provider. Please wait and retry, or switch models."
                elif "401" in error_msg or "API key" in error_msg or "unauthorized" in error_msg.lower():
                    error_msg = f"Authentication failed for {provider}. Please check your API key in Settings. (Original error: {error_msg})"
                elif "Could not find model" in error_msg or "404" in error_msg:
                    error_msg = "Model not found. Please select a different model."
            return {
                "messages": [AIMessage(content=f"❌ {error_msg}")],
                "current_tool_calls": [],
                "context_data": {"error": str(invoke_err)}
            }
    duration = time.perf_counter() - start_time
    
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "default")
    log_performance("LLM_REASONING", duration, {"provider": provider, "model": model})
    logger.info(f"PIPELINE: LLM responded in {duration:.2f}s, content length={len(str(response.content))}")
    
    tool_calls = getattr(response, "tool_calls", [])
    logger.info(f"PIPELINE: Tool calls: {len(tool_calls)}")
    
    # Telemetry Update
    telemetry = state.get("telemetry", {})
    if "latencies" not in telemetry: telemetry["latencies"] = {}
    telemetry["latencies"]["reason_node"] = duration
    
    return {
        "messages": [response],
        "current_tool_calls": tool_calls,
        "context_data": {"history_len": len(messages), "summarized": bool(summary)},
        "telemetry": telemetry
    }

async def execute_tool_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Tool execution node. Dispatches to the compiled LangChain tools.
    """
    node_start = time.perf_counter()
    last_message = state["messages"][-1]
    tool_messages = []
    
    if not hasattr(last_message, "tool_calls"):
        return {"messages": [], "current_tool_calls": []}

    conversation_id = config.get("configurable", {}).get("conversation_id")
    tools = get_agent_tools(conversation_id)
    tool_map = {t.name: t for t in tools}

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_id = tool_call["id"]
        
        logger.info(f"Executing tool: {tool_name} with args: {tool_args}")
        
        start_time = time.perf_counter()
        tool = tool_map.get(tool_name)
        if tool:
            try:
                # Use the compiled LangChain tool which safely handles async
                result = await tool.ainvoke(tool_args)
                duration = time.perf_counter() - start_time
                log_performance("TOOL_CALL", duration, {"tool": tool_name})
                
                # result is usually the output string or a SkillResult if duck-typing applies
                if hasattr(result, "success"):
                    tool_result = result.output or result.error or "Success (no output)"
                    if not result.success and not result.error:
                        tool_result = f"Error: {tool_result}"
                else:
                    tool_result = str(result)
            except Exception as e:
                tool_result = f"Exception during tool execution: {str(e)}"
        else:
            tool_result = f"Error: Tool '{tool_name}' not found."
        
        tool_messages.append(
            ToolMessage(
                content=str(tool_result),
                tool_call_id=tool_id,
                name=tool_name
            )
        )
        
    # Telemetry Update
    telemetry = state.get("telemetry", {})
    if "latencies" not in telemetry: telemetry["latencies"] = {}
    telemetry["latencies"]["tool_execution"] = time.perf_counter() - node_start

    return {"messages": tool_messages, "current_tool_calls": [], "telemetry": telemetry}
