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

async def get_dynamic_llm(config: RunnableConfig, bind_tools: bool = True, tier: str = "reasoning"):
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
    
    # ─── Tiered Model Routing ───
    if tier in ("routing", "guard", "validation"):
        if provider == "gemini":
            model = "gemini-1.5-flash"
        elif provider == "openrouter":
            model = "meta-llama/llama-3-8b-instruct"
        elif provider == "groq":
            model = "llama-3.1-8b-instant"
        elif provider == "local":
            model = "llama3"
    elif tier in ("reasoning", "coder"):
        if provider == "gemini":
            model = "gemini-1.5-pro"
        elif provider == "openrouter":
            model = "anthropic/claude-3.5-sonnet"
        elif provider == "groq":
            model = "llama-3.3-70b-versatile"
        elif provider == "local":
            model = "codellama"
            
    # Resolve API Key for the resolved provider from api_keys dict if available
    api_keys = config.get("configurable", {}).get("api_keys", {})
    if api_keys and provider in api_keys:
        api_key = api_keys[provider]
    
    if not agent_mode:
        bind_tools = False

    # Debug logging for model initialization
    logger.debug(f"DEBUG: Initializing LLM Provider: {provider} | Model: {model} | Agent Mode: {agent_mode}")

    model_config = config.get("configurable", {}).get("model_config", {})
    temp = model_config.get("temperature", 0.0)
    max_toks = model_config.get("max_tokens", 4096)

    try:
        if provider == "colab_bridge":
            base_url = config.get("configurable", {}).get("base_url")
            if base_url:
                from langchain_openai import ChatOpenAI
                target_model = model or "gemma-4-E4B_q4_0-it"
                if not base_url.endswith("/v1"):
                    base_url = f"{base_url.rstrip('/')}/v1"
                llm = ChatOpenAI(
                    model=target_model,
                    base_url=base_url,
                    api_key=api_key or "sk-colab",
                    temperature=temp,
                    max_tokens=max_toks,
                    streaming=True
                )
            else:
                from codex_spaces.backend.agent.bridge_llm import ChatBridge
                user_id = config.get("configurable", {}).get("user_id")
                space_slug = config.get("configurable", {}).get("space_slug")
                if not user_id or not space_slug:
                    raise ValueError("Colab bridge requires 'user_id' and 'space_slug' in configuration or a custom base URL.")
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
                # Ensure the correct model flavor is loaded/swapped dynamically
                try:
                    from backend.utils.llama_manager import LlamaServerManager
                    LlamaServerManager.ensure_model_loaded(local_model)
                except Exception as e:
                    logger.warning(f"[LlamaManager] Dynamic model load check failed: {e}")

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
    Also implements a fast-path heuristic classifier for conversational queries.
    """
    start_time = time.perf_counter()
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "default")
    
    # Telemetry initialization (if not already done by chat.py)
    telemetry = state.get("telemetry") or {}
    if not telemetry:
        telemetry = {
            "ttft": 0, "total_tokens": 0, "usage": {"input": 0, "output": 0},
            "latencies": {}, "capabilities": [], "provider": provider, "model": model
        }
    if "latencies" not in telemetry:
        telemetry["latencies"] = {}
    
    # Tier 1: Metadata Handshake
    from backend.utils.telemetry import get_model_capabilities
    telemetry["capabilities"] = get_model_capabilities(provider, model)
    
    # Tier 2: Latency Benchmark (Initial probe)
    # For now, we'll just mark the init node duration
    telemetry["latencies"]["init_node"] = time.perf_counter() - start_time
    
    # Short Process Heuristic Classification
    client_type = state.get("client_type", config.get("configurable", {}).get("client_type", "web"))
    is_short_process = False
    messages = state.get("messages", [])
    if messages:
        # Find the last HumanMessage
        from langchain_core.messages import HumanMessage
        last_human = None
        for m in reversed(messages):
            if isinstance(m, HumanMessage) or getattr(m, "type", "") == "human":
                last_human = m
                break
        
        if last_human and last_human.content:
            query = str(last_human.content).strip().lower()
            
            # Common greetings and acknowledgments
            greetings = {"hi", "hello", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening", "yo"}
            acknowledgments = {"thanks", "thank you", "ok", "okay", "yes", "no", "cool", "perfect", "bye", "goodbye", "awesome"}
            
            # Direct match or startswith check
            is_greeting = query in greetings or any(query.startswith(g + " ") for g in greetings)
            is_ack = query in acknowledgments or any(query.startswith(a + " ") for a in acknowledgments)
            
            if is_greeting or is_ack:
                is_short_process = True
            elif client_type in ("vscode", "aidock") and len(query) < 45:
                # Check for technical actions and file extensions
                action_words = {"create", "write", "run", "make", "build", "generate", "code", "modify", "implement", "add", "fix", "delete", "remove", "update"}
                has_action = any(word in query for word in action_words)
                
                extensions = {".py", ".ts", ".js", ".html", ".css", ".json", ".yml", ".yaml", ".sh", ".bat", ".md"}
                has_ext = any(ext in query for ext in extensions)
                
                if not has_action and not has_ext:
                    is_short_process = True

    return {"telemetry": telemetry, "is_short_process": is_short_process}

async def guard_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Pre-reasoning guard that validates context health before invoking the LLM.
    Detects:
      1. Stuck loops — 3+ identical consecutive tool calls
      2. Excessive context — token count approaching model limits
    Short-circuits with a user-friendly error instead of producing garbage.
    """
    messages = state["messages"]
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "default")
    
    # 1. Stuck Loop Detection: check last N tool calls for repetition within the current turn
    recent_tool_calls = []
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            break
        if hasattr(m, "tool_calls") and m.tool_calls:
            for tc in m.tool_calls:
                import json
                try:
                    args_str = json.dumps(tc.get("args", {}), sort_keys=True)
                except Exception:
                    args_str = str(tc.get("args", {}))
                recent_tool_calls.append((tc.get("name", ""), args_str))
            if len(recent_tool_calls) >= 3:
                break
    
    if len(recent_tool_calls) >= 3:
        last_three = recent_tool_calls[:3]
        if len(set(last_three)) == 1:
            stuck_tool = last_three[0][0]
            logger.warning(f"GUARD: Stuck loop detected — tool '{stuck_tool}' called 3 times consecutively with same arguments")
            return {
                "messages": [AIMessage(
                    content=f"[WARNING] I appear to be stuck in a loop calling `{stuck_tool}` repeatedly with the same arguments. "
                             "Let me step back and address your request differently. "
                             "Could you rephrase what you need, or should I try a different approach?"
                )],
                "current_tool_calls": [],
                "is_complete": True
            }
    
    # 2. Context Budget Pre-check (warn, don't block — reason_node handles summarization)
    from backend.utils.telemetry import estimate_tokens, get_model_context_limit
    total_tokens = sum(estimate_tokens(str(m.content)) for m in messages)
    context_limit = get_model_context_limit(provider, model)
    
    if total_tokens > context_limit * 0.95:
        logger.warning(f"GUARD: Context critically full ({total_tokens}/{context_limit} tokens)")
        # Don't block — reason_node will summarize, but log for observability
    
    telemetry = state.get("telemetry", {})
    if "latencies" not in telemetry:
        telemetry["latencies"] = {}
    telemetry["context_tokens"] = total_tokens
    telemetry["context_limit"] = context_limit
    
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
        
    llm = await get_dynamic_llm(config, bind_tools=False, tier="routing")
    summary_prompt = "Summarize the key points of the preceding conversation history concisely. Focus on technical decisions and user goals."
    response = await llm.ainvoke([HumanMessage(content=f"{str(to_summarize)}\n\n{summary_prompt}")])
    return response.content

def resolve_llm_fallback(current_provider: str, current_model: str, api_keys: dict) -> tuple[str, str, str]:
    """
    Resolves the next fallback provider, model name, and API key.
    Ensures zero-cost local Ollama fallback is always available.
    """
    fallback_chain = ["ollama_cloud", "openrouter", "groq", "gemini", "local"]
    
    # Normalize model mapping from current model to fallback models
    model_mappings = {
        "ollama_cloud": {
            "default": "llama3",
            "llama3": "llama3"
        },
        "openrouter": {
            "default": "meta-llama/llama-3-8b-instruct",
            "meta-llama/llama-3-8b-instruct": "meta-llama/llama-3-8b-instruct",
            "google/gemini-flash-1.5": "google/gemini-flash-1.5"
        },
        "groq": {
            "default": "llama3-8b-8192",
            "llama3-8b-8192": "llama3-8b-8192",
            "llama3-70b-8192": "llama3-70b-8192"
        },
        "gemini": {
            "default": "gemini-1.5-flash",
            "gemini-1.5-flash": "gemini-1.5-flash",
            "gemini-1.5-pro": "gemini-1.5-pro"
        },
        "local": {
            "default": "default"
        }
    }
    
    for provider in fallback_chain:
        if provider == current_provider:
            continue
        
        # Check if API key is available (local doesn't need a key)
        key = api_keys.get(provider)
        if key or provider == "local":
            provider_models = model_mappings.get(provider, {})
            # Map equivalent model
            fallback_model = provider_models.get(current_model, provider_models.get("default", "default"))
            return provider, fallback_model, key
            
    return None, None, None

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
    
    # Context Budgeting: Token-aware summarization
    from backend.utils.telemetry import estimate_tokens, get_model_context_limit
    
    total_tokens = sum(estimate_tokens(str(m.content)) for m in messages)
    context_limit = get_model_context_limit(provider, model)
    budget_threshold = int(context_limit * 0.7)  # Leave 30% headroom for system prompt + response
    
    summary = ""
    if total_tokens > budget_threshold and len(messages) > 6:
        logger.info(f"PIPELINE: Context budget exceeded ({total_tokens}/{budget_threshold} tokens). Summarizing...")
        summary = await summarize_history(messages, config)
        # Keep only the system message, the summary, and the last 5 messages
        system_msg = messages[0]
        recent_msgs = messages[-5:]
        messages = [system_msg, HumanMessage(content=f"Summary of previous turns: {summary}")] + recent_msgs
        logger.info(f"PIPELINE: Context compressed to {len(messages)} messages")
    conversation_id = config.get("configurable", {}).get("conversation_id", "default")
    space_config = state.get("space_config", {})
    allowed_skills = space_config.get("skills", ["all"])
    
    # NOTE: System prompt is built AFTER tool binding (see below, L~420)
    # so we can inject tool-binding telemetry into the prompt.

    # Initialize context builder with provider-aware budget
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model", "")
    p_label = {
        "groq": "Groq",
        "openrouter": "OpenRouter",
        "gemini": "Google Gemini",
        "ollama_cloud": "Ollama Cloud",
        "local": "Local Ollama",
        "colab_bridge": "Colab Bridge",
    }.get(provider, provider.title())

    # Early Auth Check for Cloud Providers
    if provider in ["groq", "openrouter", "gemini", "ollama_cloud"]:
        api_key = config.get("configurable", {}).get("api_key")
        
        is_missing = not api_key or (provider == "ollama_cloud" and api_key == "sk-ollama")
        if is_missing:
            # Try to resolve fallback since primary key is missing
            api_keys = config.get("configurable", {}).get("api_keys", {})
            fallback_prov, fallback_model, fallback_key = resolve_llm_fallback(provider, model, api_keys)
            
            if fallback_prov:
                logger.warning(f"PIPELINE WARNING: Provider [{provider}] API key is missing. Automatically falling back to [{fallback_prov}]...")
                
                # Notify UI via WebSocket stream
                websocket = config.get("configurable", {}).get("websocket")
                if websocket:
                    try:
                        await websocket.send_json({
                            "type": "token",
                            "content": f"\n\n[WARNING] *[{provider.upper()}] API key missing. Switching to [{fallback_prov.upper()}] ({fallback_model})...*\n\n",
                            "node": "provider_fallback"
                        })
                    except Exception as ws_err:
                        logger.error(f"PIPELINE ERROR: Failed to stream fallback message: {ws_err}")
                
                # Construct config override for fallback
                config_copy = dict(config)
                config_copy["configurable"] = dict(config.get("configurable", {}))
                config_copy["configurable"]["provider"] = fallback_prov
                config_copy["configurable"]["model"] = fallback_model
                config_copy["configurable"]["api_key"] = fallback_key
                config = config_copy
                
                # Record failed attempt and update loop variables
                telemetry = state.get("telemetry", {})
                if "provider_attempts" not in telemetry:
                    telemetry["provider_attempts"] = []
                telemetry["provider_attempts"].append(f"{provider} ({model}) - failed: API key missing")
                
                provider = fallback_prov
                model = fallback_model
                # Fallback applied — continue execution with new provider
            else:
                # No fallback available — return an error to the user
                return {
                    "messages": [AIMessage(content=f"[ERROR] **{p_label} API Key Missing**\nPlease open the **Settings** (gear icon) and add your API key for {p_label} to enable this Neural core.")],
                    "current_tool_calls": [],
                    "context_data": {"error": "auth_missing"}
                }

    logger.info(f"PIPELINE: Initializing context builder for provider={provider}...")
    context_builder = get_context_builder(provider=provider)
    
    # Context builder is saved for use AFTER tool binding, when the system prompt is ready.
    # At this point we only log its availability — actual context build happens post-binding.
    if context_builder:
        logger.info("PIPELINE: ContextBuilder available. Will apply after tool binding.")
    else:
        logger.warning("PIPELINE: ContextBuilder is None. Will use fallback message formatting.")
    
    logger.info(f"PIPELINE: Proceeding to LLM init (message count={len(messages)})...")
    
    # Initialize tools and binding logic
    client_type = state.get("client_type", config.get("configurable", {}).get("client_type", "web"))
    tools = get_agent_tools(conversation_id, allowed_skills, client_type=client_type)
    
    # Dynamically bind client-side MCP tools from scratchpad
    scratchpad_data = state.get("scratchpad") or {}
    mcp_tools_list = scratchpad_data.get("mcp_tools") or []
    if mcp_tools_list:
        from langchain_core.tools import StructuredTool
        for mcp_t in mcp_tools_list:
            tool_name = mcp_t.get("name")
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
    
    # Use the dynamic LLM with tools bound
    try:
        # get_dynamic_llm is defined in this file
        llm = await get_dynamic_llm(config, bind_tools=False, tier="reasoning") 
        
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
        
        tool_binding_status = ""
        is_short_process = state.get("is_short_process", False)
        
        if is_short_process:
            logger.info(f"PIPELINE: Short process detected. Suppressing tool binding for conversational reply.")
            tool_binding_status = "No tools available. Respond conversationally."
        elif valid_tools and has_tool_support and not isinstance(llm, NativeLocalClient):
            logger.info(f"PIPELINE: Binding {len(valid_tools)} tools to LLM (Model: {model})")
            llm = llm.bind_tools(valid_tools)
            tool_binding_status = f"Tools bound successfully: {[t.name for t in valid_tools]}. You MUST use these tools for file/command operations."
        elif valid_tools:
            logger.info(f"PIPELINE: Skipping tool binding for '{model}' (Capability 'Tools' not found in {capabilities})")
            tool_binding_status = f"WARNING: Tool binding was SKIPPED for this model ({model}). You cannot call tools. Respond conversationally only."
        else:
            tool_binding_status = "No tools available for this session."
    except Exception as init_err:
        logger.error(f"PIPELINE ERROR: LLM init failed — {init_err}")
        telemetry = state.get("telemetry", {})
        if "provider_attempts" not in telemetry:
            telemetry["provider_attempts"] = []
        failed_attempt = f"{provider} ({model}) - failed: {init_err}"
        if not telemetry["provider_attempts"] or failed_attempt not in telemetry["provider_attempts"]:
            telemetry["provider_attempts"].append(failed_attempt)
        return {
            "messages": [AIMessage(content=f"[ERROR] LLM initialization failed: {init_err}")],
            "current_tool_calls": [],
            "context_data": {"error": str(init_err)},
            "telemetry": telemetry
        }
    
    # Build system prompt AFTER tool binding so we can inject tool-binding status (Layer 3)
    system_prompt = build_system_prompt(conversation_id, allowed_skills, tool_binding_status)
    
    consideration = state.get("consideration_vector")
    if consideration:
        system_prompt += (
            f"\n\n[CRITICAL CONSIDERATION VECTOR]\n"
            f" - Strategy Priority: {consideration.get('priority', 'N/A')}\n"
            f" - Focus Area: {consideration.get('focus_area', 'N/A')}\n"
            f" - Anti-Pattern Guardrail: {consideration.get('anti_pattern_guard', 'None')}\n"
            f"Adhere strictly to this vector. Do not delete existing code/tests blindly to bypass compilation failures."
        )

    # Format the writeable JSON planning scratchpad if present
    scratchpad_data = state.get("scratchpad") or {}
    task_plan = scratchpad_data.get("task_plan")
    formatted_plan = ""
    if task_plan:
        if isinstance(task_plan, list):
            formatted_plan = "\n".join([f"- [{'x' if t.get('done') else ' '}] {t.get('text', '')}" for t in task_plan if isinstance(t, dict)])
        elif isinstance(task_plan, str):
            formatted_plan = task_plan
            
    if formatted_plan:
        system_prompt += f"\n\n[PERSISTENT TASK PLAN SCRATCHPAD]\n{formatted_plan}\n"
    
    if space_config.get("system_prompt_prefix"):
        system_prompt = f"{space_config['system_prompt_prefix']}\n\n{system_prompt}"
    
    # Rebuild context with the tool-aware system prompt
    if context_builder:
        messages = context_builder.build_context(messages, system_prompt=system_prompt)
    else:
        from langchain_core.messages import SystemMessage as _SysMsg
        messages = [_SysMsg(content=system_prompt)] + [m for m in messages if m.type != "system"]
    
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
        
        # Track failed attempt in telemetry
        telemetry = state.get("telemetry", {})
        if "provider_attempts" not in telemetry:
            telemetry["provider_attempts"] = []
        telemetry["provider_attempts"].append(f"{provider} ({model}) - failed: {error_msg}")
        
        # ─── DYNAMIC PROVIDER FALLBACK (LOOP ENGINEERING) ───
        api_keys = config.get("configurable", {}).get("api_keys", {})
        fallback_prov, fallback_model, fallback_key = resolve_llm_fallback(provider, model, api_keys)
        
        if fallback_prov:
            logger.warning(f"PIPELINE WARNING: Provider [{provider}] failed with [{error_msg}]. Automatically switching to [{fallback_prov}] fallback...")
            
            # Notify UI via WebSocket stream
            websocket = config.get("configurable", {}).get("websocket")
            if websocket:
                try:
                    await websocket.send_json({
                        "type": "token",
                        "content": f"\n\n[WARNING] *[{provider.upper()}] rate/quota limit or connection error. Switching to [{fallback_prov.upper()}] ({fallback_model})...*\n\n",
                        "node": "provider_fallback"
                    })
                except Exception as ws_err:
                    logger.error(f"PIPELINE ERROR: Failed to stream fallback message: {ws_err}")
            
            try:
                # Construct config override for fallback
                config_copy = dict(config)
                config_copy["configurable"] = dict(config.get("configurable", {}))
                config_copy["configurable"]["provider"] = fallback_prov
                config_copy["configurable"]["model"] = fallback_model
                config_copy["configurable"]["api_key"] = fallback_key
                
                llm_fallback = await get_dynamic_llm(config_copy, bind_tools=True)
                response = await _asyncio.wait_for(llm_fallback.ainvoke(messages), timeout=request_timeout)
                
                # Update loop variables on success
                provider = fallback_prov
                model = fallback_model
                telemetry["provider_attempts"].append(f"{fallback_prov} ({fallback_model})")
                invoke_err = None  # Clear error!
            except Exception as fallback_err:
                logger.error(f"PIPELINE ERROR: Fallback switch also failed: {fallback_err}")
                error_msg = f"Original error: {error_msg}. Fallback to {fallback_prov} also failed: {fallback_err}"
        
        # ─── TOOL FALLBACK ───
        if invoke_err:
            is_tool_error = "does not support tools" in error_msg or "invalid_request_error" in error_msg
            if is_tool_error and "valid_tools" in locals() and valid_tools:
                logger.warning(f"PIPELINE WARNING: Tool-calling error caught: {error_msg}. Retrying without tools...")
                try:
                    llm_fallback_no_tools = await get_dynamic_llm(config, bind_tools=False)
                    response = await _asyncio.wait_for(llm_fallback_no_tools.ainvoke(messages), timeout=request_timeout)
                    invoke_err = None 
                except Exception as retry_err:
                    logger.error(f"PIPELINE ERROR: Fallback without tools also failed: {retry_err}")
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
                "messages": [AIMessage(content=f"[ERROR] {error_msg}")],
                "current_tool_calls": [],
                "context_data": {"error": str(invoke_err)}
            }
    duration = time.perf_counter() - start_time
    
    log_performance("LLM_REASONING", duration, {"provider": provider, "model": model})
    logger.info(f"PIPELINE: LLM responded in {duration:.2f}s, content length={len(str(response.content))}")
    
    tool_calls = getattr(response, "tool_calls", [])
    logger.info(f"PIPELINE: Tool calls: {len(tool_calls)}")
    
    # Telemetry Update
    telemetry = state.get("telemetry", {})
    if "latencies" not in telemetry: telemetry["latencies"] = {}
    telemetry["latencies"]["reason_node"] = duration
    
    if "provider_attempts" not in telemetry:
        telemetry["provider_attempts"] = []
    
    # Record success of current provider/model in the attempts list
    success_str = f"{provider} ({model})"
    if not telemetry["provider_attempts"] or not any(success_str in attempt for attempt in telemetry["provider_attempts"]):
        telemetry["provider_attempts"].append(success_str)
        
    if "tokens" not in telemetry:
        telemetry["tokens"] = {}
    telemetry["tokens"]["input"] = total_tokens
    telemetry["tokens"]["output"] = estimate_tokens(str(response.content))
    
    # Record recent tool actions fingerprint
    fingerprints = state.get("recent_actions_fingerprint") or []
    for tc in tool_calls:
        import json
        try:
            args_str = json.dumps(tc.get("args", {}), sort_keys=True)
        except Exception:
            args_str = str(tc.get("args", {}))
        fingerprints.append(f"{tc.get('name')}:{args_str}")
    fingerprints = fingerprints[-10:]

    return {
        "messages": [response],
        "current_tool_calls": tool_calls,
        "context_data": {"history_len": len(messages), "summarized": bool(summary)},
        "telemetry": telemetry,
        "recent_actions_fingerprint": fingerprints
    }

async def execute_tool_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Tool execution node. Dispatches to the compiled LangChain tools or delegates to client-side.
    """
    import asyncio
    node_start = time.perf_counter()
    last_message = state["messages"][-1]
    tool_messages = []
    
    if not hasattr(last_message, "tool_calls"):
        return {"messages": [], "current_tool_calls": []}

    conversation_id = config.get("configurable", {}).get("conversation_id")
    tools = get_agent_tools(conversation_id)
    
    # Dynamically bind client-side MCP tools from scratchpad
    scratchpad_data = state.get("scratchpad") or {}
    mcp_tools_list = scratchpad_data.get("mcp_tools") or []
    if mcp_tools_list:
        from langchain_core.tools import StructuredTool
        for mcp_t in mcp_tools_list:
            tool_name = mcp_t.get("name")
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
            
    tool_map = {t.name: t for t in tools}

    client_type = state.get("client_type", config.get("configurable", {}).get("client_type", "web"))
    websocket = config.get("configurable", {}).get("websocket")
    client_tool_responses = config.get("configurable", {}).get("client_tool_responses")

    state_updates = {}

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_id = tool_call["id"]
        
        CLIENT_DELEGATED_TOOLS = {
            "vscode": {"workspace_writer", "workspace_reader", "shell_exec", "workspace_patcher"},
            "aidock": {"workspace_writer", "workspace_reader", "shell_exec", "workspace_patcher"}
        }
        
        delegated_for_client = CLIENT_DELEGATED_TOOLS.get(client_type, set())
        is_client_tool = tool_name in delegated_for_client
        
        if tool_name == "compact_context":
            from langchain_core.messages import RemoveMessage, SystemMessage
            messages = state.get("messages", [])
            if not messages:
                tool_result = "No history available to compact."
            else:
                system_instructions = [m for m in messages if isinstance(m, SystemMessage)]
                active_tail = messages[-4:]
                
                system_len = len(system_instructions)
                intermediate_history = messages[system_len:-4]
                
                if len(intermediate_history) < 3:
                    tool_result = "History tail is too short. Compaction skipped."
                else:
                    try:
                        llm = await get_dynamic_llm(config, bind_tools=False, tier="validation")
                        summary_prompt = (
                            "Condense the following tool traces, command outputs, and assistant reasoning turns "
                            "into a high-density chronological bullet-point summary of what was done, what issues were resolved, "
                            "and what files were changed. Do not omit any file paths or compiler errors.\n\n"
                            f"History to condense:\n{str(intermediate_history)}"
                        )
                        summary_res = await llm.ainvoke([HumanMessage(content=summary_prompt)])
                        summary_text = summary_res.content
                        
                        remove_commands = []
                        for m in intermediate_history:
                            if m.id:
                                remove_commands.append(RemoveMessage(id=m.id))
                                
                        # Append remove commands directly to tool_messages so add_messages processes them
                        tool_messages.extend(remove_commands)
                        tool_messages.append(SystemMessage(content=f"[CONTEXT COMPACTED] Summary of preceding work:\n{summary_text}"))
                        
                        old_size = sum(len(str(m.content)) for m in intermediate_history)
                        new_size = len(summary_text)
                        saved_chars = max(0, old_size - new_size)
                        tool_result = f"Success: Compacted memory. Saved approximately {saved_chars // 4} tokens."
                    except Exception as e:
                        tool_result = f"Error during memory compaction: {str(e)}"
                        
        elif tool_name == "write_scratchpad":
            import json
            try:
                task_list_json = tool_args.get("task_list_json", "[]")
                tasks = json.loads(task_list_json)
                scratchpad = state.get("scratchpad") or {}
                scratchpad["task_plan"] = tasks
                state_updates["scratchpad"] = scratchpad
                tool_result = f"Scratchpad planning board updated successfully with {len(tasks)} tasks."
            except Exception as e:
                tool_result = f"Error updating planning board: {str(e)}"
                
        elif is_client_tool and websocket and client_tool_responses:
            logger.info(f"Delegating tool execution to VS Code client: {tool_name} with args: {tool_args}")
            try:
                # Send tool execution request to client
                await websocket.send_json({
                    "type": "client_tool_call",
                    "name": tool_name,
                    "args": tool_args,
                    "id": tool_id
                })
                # Wait for tool response from client (120s timeout)
                response_payload = await asyncio.wait_for(client_tool_responses.get(), timeout=120.0)
                tool_result = response_payload.get("output", "")
            except asyncio.TimeoutError:
                tool_result = f"Error: Tool execution timed out on the client."
            except Exception as e:
                tool_result = f"Error during client tool execution delegation: {str(e)}"
        else:
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

    return {"messages": tool_messages, "current_tool_calls": [], "telemetry": telemetry, **state_updates}

async def validate_response_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Post-reasoning validator (Layer 2). Detects if the model fabricated file/command
    outputs without calling tools, and injects a correction message to trigger
    one more reasoning cycle via guard → reason.
    
    This node only fires when reason_node returned NO tool calls (i.e.,
    should_continue routed here instead of to execute_tool).
    Max 1 retry to prevent infinite loops.
    """
    messages = state["messages"]
    last_ai = messages[-1] if messages else None
    
    if not last_ai or getattr(last_ai, "type", "") != "ai":
        return {"is_complete": True}  # Nothing to validate
    
    # Circuit breaker: check if we already retried
    retry_count = state.get("context_data", {}).get("fabrication_retries", 0)
    if retry_count >= 1:
        logger.info("VALIDATOR: Max retries reached, accepting response as-is")
        return {"is_complete": True}
    
    # Check: does the response contain Canvas code blocks but no tool calls?
    content = str(last_ai.content)
    has_canvas_code = "[CANVAS:CODE:" in content
    has_fabricated_shell = any(marker in content for marker in [
        "Successfully created", "File written to", "Script executed",
        "I've created the file", "I have written"
    ])
    has_tool_calls = bool(getattr(last_ai, "tool_calls", []))
    
    # Check: does the model have tool support in this session?
    capabilities = state.get("telemetry", {}).get("capabilities", [])
    has_tool_support = "Tools" in capabilities
    
    if not has_tool_support:
        # Model genuinely can't call tools — don't retry
        return {"is_complete": True}
    
    if (has_canvas_code or has_fabricated_shell) and not has_tool_calls:
        logger.warning(
            f"VALIDATOR: Fabrication detected — Canvas/shell output present "
            f"but 0 tool calls. Injecting correction. (retry={retry_count})"
        )
        correction = SystemMessage(
            content=(
                "CRITICAL CORRECTION: Your previous response contained code or "
                "file creation claims without calling the required tools. "
                "[CANVAS:...] blocks do NOT write files to disk. "
                "You MUST call 'workspace_writer' to create files and "
                "'shell_exec' to run commands. "
                "Re-attempt your response using ONLY tool calls."
            )
        )
        context_data = state.get("context_data", {})
        context_data["fabrication_retries"] = retry_count + 1
        
        # Optimize token usage: truncate the fabricated response content in the history.
        # This prevents sending back large code blocks as input tokens to the retry turn.
        last_ai_id = getattr(last_ai, "id", None)
        truncated_text = f"[Fabrication detected: Omitted original {len(content)} characters of code/text for token efficiency]"
        if last_ai_id:
            truncated_ai = AIMessage(
                content=truncated_text,
                id=last_ai_id,
                tool_calls=[]
            )
            messages_to_return = [truncated_ai, correction]
        else:
            try:
                last_ai.content = truncated_text
            except Exception:
                pass
            messages_to_return = [correction]
            
        return {
            "messages": messages_to_return,
            "context_data": context_data,
            "is_complete": False
        }
    
    return {"is_complete": True}


async def verification_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Verification node following tool execution.
    Checks if files were modified (via workspace_writer) and triggers client-side
    linter/compiler compilation checks to feed back errors and self-correct.
    """
    import uuid
    messages = state.get("messages", [])
    if not messages:
        return {}
        
    last_message = messages[-1]
    
    # Check if we just completed a verification tool call
    if isinstance(last_message, ToolMessage) and last_message.name == "shell_exec":
        # We just executed the compilation/linting tool
        content = last_message.content.lower()
        has_error = False
        error_summary = ""
        
        # Look for typical compilation or syntax errors
        if "error ts" in content or ("tsc -p" in content and "error" in content):
            has_error = True
            error_summary = "TypeScript compilation failed."
        elif "syntaxerror" in content or "invalid syntax" in content:
            has_error = True
            error_summary = "Python syntax error."
        elif "failed" in content or "exception" in content:
            has_error = True
            error_summary = "Test execution failed."
            
        if has_error:
            feedback_msg = SystemMessage(
                content=(
                    f"⚠️ [VERIFICATION FAILURE] {error_summary}\n"
                    f"Compiler/Linter Output:\n```\n{last_message.content}\n```\n"
                    f"Please fix the errors in your code."
                )
            )
            return {"messages": [feedback_msg]}
        else:
            feedback_msg = SystemMessage(
                content="✅ [VERIFICATION SUCCESS] Code verification passed successfully. No errors detected."
            )
            return {"messages": [feedback_msg]}
            
    # Check if any workspace files were written in the recent turn
    # Scan backwards from the end until we hit a HumanMessage
    files_modified = []
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            break
        # If it's an AIMessage with tool_calls for writing files
        if isinstance(m, AIMessage) and hasattr(m, "tool_calls") and m.tool_calls:
            for tc in m.tool_calls:
                if tc.get("name") == "workspace_writer":
                    args = tc.get("args") or {}
                    filename = args.get("filename")
                    if filename:
                        files_modified.append(filename)
                        
    if files_modified:
        # Determine the appropriate verification command
        command = ""
        cwd = "."
        
        # Check if any modified file is in the vscode-extension
        if any("vscode-extension" in f for f in files_modified):
            command = "npm run compile"
            cwd = "projects/iarxii/AI_Codex/vscode-extension"
        elif any(f.endswith(".py") for f in files_modified):
            # Check syntax for Python files
            py_files = [f for f in files_modified if f.endswith(".py")]
            # Run syntax compilation check on the first python file
            command = f"python -m py_compile {py_files[0]}"
            cwd = "."
            
        if command:
            # Emit verification tool call
            tool_call_id = f"verify_{uuid.uuid4().hex[:8]}"
            verification_message = AIMessage(
                content="[VERIFICATION] Verifying recent changes...",
                tool_calls=[{
                    "name": "shell_exec",
                    "args": {"command": command, "cwd": cwd},
                    "id": tool_call_id
                }]
            )
            return {"messages": [verification_message]}
            
    return {}


async def evaluate_turn_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Evaluator Node (Quality Gate).
    Compares the updated execution artifacts and messages against the user's task_goal.
    Determines if the goal has been achieved, computes a quality score, and updates
    the consideration vector to steer the agent away from destructive behaviors.
    """
    messages = state["messages"]
    goal = state.get("task_goal") or (messages[0].content if messages else "")
    artifacts = state.get("execution_artifacts") or {}
    last_action = messages[-1].content if messages else ""
    
    # Calculate modification ratios (additions vs deletions)
    lines_added = artifacts.get("lines_added", 0)
    lines_deleted = artifacts.get("lines_deleted", 0)
    
    llm = await get_dynamic_llm(config, bind_tools=False, tier="validation")
    
    eval_prompt = f"""
    You are the Autonomous Quality Gate for AICodex.
    Analyze the recent work against the Ultimate Goal.
    
    Ultimate Goal: {goal}
    Current Artifacts (Modified Files/State): {artifacts}
    Code Changes: Added {lines_added} lines, Deleted {lines_deleted} lines.
    Last Agent Message: {last_action}
    
    Verify:
    1. Did the code compile or pass tests successfully?
    2. Are modifications constructive (adding features/fixes) or destructive (blindly deleting failing tests/code blocks)?
    
    Respond in JSON format with keys:
    {{
        "goal_achieved": true | false,
        "quality_score": 0.0 to 1.0,
        "critique": "Analysis of what is missing or if errors remain",
        "next_instruction": "Command or directive the agent must give itself to continue",
        "consideration_vector": {{
            "priority": "ADDITION_PREFERRED" | "REFACTOR" | "BUG_FIX",
            "anti_pattern_guard": "Instructions on what to avoid, e.g., 'Do not delete the module router to fix imports'",
            "focus_area": "Target file or error block to repair"
        }}
    }}
    """
    
    response = await llm.ainvoke([HumanMessage(content=eval_prompt)])
    
    import json
    try:
        cleaned_content = response.content.strip().strip("```json").strip("```").strip()
        eval_report = json.loads(cleaned_content)
    except Exception:
        eval_report = {
            "goal_achieved": False,
            "quality_score": 1.0,
            "critique": "Failed to parse evaluator response. Assuming incomplete.",
            "next_instruction": "",
            "consideration_vector": {"priority": "BUG_FIX", "anti_pattern_guard": "", "focus_area": ""}
        }
        
    quality_history = state.get("quality_history") or []
    quality_history = list(quality_history) + [eval_report.get("quality_score", 1.0)]
        
    return {
        "evaluation_report": eval_report,
        "quality_history": quality_history,
        "consideration_vector": eval_report.get("consideration_vector", {})
    }


async def final_report_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Synthesis Node.
    Summarizes the agent's work and outputs actionable next steps/recommendations.
    """
    messages = state["messages"]
    goal = state.get("task_goal") or ""
    
    internal_trail = []
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.content:
            internal_trail.append(f"- Agent: {msg.content[:200]}...")
        elif isinstance(msg, ToolMessage):
            internal_trail.append(f"- Tool executed ({msg.name}): {str(msg.content)[:100]}")
            
    trail_str = "\n".join(internal_trail)
    llm = await get_dynamic_llm(config, bind_tools=False, tier="reasoning")
    
    summary_prompt = f"""
    You are the Final Synthesis layer of AICodex. 
    The agent has successfully completed the user's task. Summarize the process, directly acknowledge the user, and provide concrete next steps.
    
    Ultimate Goal: {goal}
    Execution Trail:
    {trail_str}
    
    Format your response in Markdown according to these strict guidelines:
    1. Begin the report by acknowledging the user directly (e.g., greet them, confirm the completion of their request).
    
    2. Then, provide the summary under these headings:
    ### 📋 Execution Summary
    * [Concise breakdown of what was achieved]
    
    ### 🚀 Recommended Next Steps
    * [2-3 concrete actions the user can take now, e.g., tests to run, code reviews, deployment]
    
    3. At the very end of your response, you MUST include an educational tutor explanation detailing the core concepts, design choices, or architectural patterns relevant to this task. This section MUST be wrapped strictly inside `[TUTOR]` and `[/TUTOR]` tags:
    [TUTOR]
    [Educational explanation of concepts, files modified, or system design decisions]
    [/TUTOR]
    """
    
    response = await llm.ainvoke([HumanMessage(content=summary_prompt)])
    return {"messages": [AIMessage(content=response.content)]}


async def handle_blocker_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Halts loop and reports degradation or stagnation to prompt user intervention.
    """
    logger.warning("Agent loop halted due to quality degradation or stagnation.")
    report = state.get("evaluation_report") or {}
    critique = report.get("critique", "No critique provided.")
    msg = AIMessage(
        content=(
            "🛑 **Execution Paused (Degradation Guard)**\n\n"
            "My self-evaluation engine detected code quality degradation or a repetitive loop.\n"
            f"**Critique:** {critique}\n\n"
            "Please review the changes and guide me on how to proceed.\n\n"
            "[REQUEST_WALL]"
        )
    )
    return {"messages": [msg], "is_complete": True}
