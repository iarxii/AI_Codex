import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, ToolMessage, SystemMessage
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

def get_dynamic_llm(config: RunnableConfig):
    provider = config.get("configurable", {}).get("provider", "local")
    model = config.get("configurable", {}).get("model")
    api_key = config.get("configurable", {}).get("api_key")
    
    tools = get_agent_tools()
    
    if provider == "groq":
        from langchain_groq import ChatGroq
        llm = ChatGroq(model=model or "llama3-8b-8192", api_key=api_key, temperature=0, streaming=True)
    elif provider == "openrouter":
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            model=model or "meta-llama/llama-3.1-8b-instruct",
            temperature=0,
            streaming=True,
            default_headers={
                "HTTP-Referer": "https://aicodex.ai",
                "X-Title": "AICodex Agentic IDE"
            }
        )
    elif provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        # Ensure model name doesn't have redundant 'models/' prefix if library adds it,
        # but the user might have selected it from the dynamic list.
        target_model = model or "gemini-1.5-flash"
        if target_model.startswith("models/"):
            target_model = target_model.replace("models/", "")
        
        llm = ChatGoogleGenerativeAI(
            model=target_model, 
            api_key=api_key, 
            temperature=0, 
            streaming=True,
            convert_system_message_to_human=True # Often needed for older models or specific API versions
        )
    else:
        # local
        from langchain_ollama import ChatOllama
        llm = ChatOllama(model=settings.DEFAULT_MODEL, base_url=settings.OLLAMA_BASE_URL, temperature=0, streaming=True)
        
    return llm.bind_tools(tools)

async def reason_node(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    """
    LLM reasoning node. Grounds the query with RAG context before invoking the LLM.
    """
    last_query = state["messages"][-1].content
    
    # 1. Retrieve relevant chunks from RAG
    retriever = get_retriever()
    retrieval_results = []
    if retriever:
        try:
            retrieval_results = retriever.retrieve(last_query)
            logger.info(f"RAG retrieved {len(retrieval_results)} chunks")
        except Exception as e:
            logger.warning(f"RAG retrieval failed: {e}")
    
    # 2. Build assembled context using OllamaOpt ContextBuilder
    context_builder = get_context_builder()
    full_prompt = last_query
    context_stats = {}
    
    if context_builder:
        try:
            # Convert retrieval results to dict format
            chunks = [
                {
                    "title": r.title,
                    "source_path": r.source_path,
                    "content": r.content,
                    "score": r.score
                } for r in retrieval_results
            ]
            
            # Build context (including history, RAG, and memory)
            assembled = context_builder.build(
                user_query=last_query,
                chat_history=state["messages"][:-1],
                retrieved_chunks=chunks,
                memory_items=[], # Long-term memory handled here
                tool_results=[] # Tool results are handled in the loop
            )
            full_prompt = context_builder.assemble_prompt_string(assembled, last_query)
            context_stats = context_builder.get_stats(assembled)
        except Exception as e:
            logger.warning(f"Context building failed: {e}")

    # 3. Invoke LLM with grounded prompt
    # We maintain the message sequence but ensure the grounding context 
    # is available. We'll prepend the grounding to the latest turn if it's a new turn,
    # or just use the history as is if we are in a tool loop.
    messages = list(state["messages"])
    
    # If the last message is a ToolMessage, we are continuing a loop.
    # If it's a HumanMessage, it's a new turn.
    if isinstance(messages[-1], HumanMessage):
        messages[-1] = HumanMessage(content=full_prompt)
        
    system_prompt = build_system_prompt()

    if not any(isinstance(m, SystemMessage) for m in messages):
        messages.insert(0, SystemMessage(content=system_prompt))
    
    logger.info(f"Invoking LLM for reasoning turn...")
    start_time = time.perf_counter()
    try:
        dynamic_llm = get_dynamic_llm(config)
        response = await dynamic_llm.ainvoke(messages, config=config)
        duration = time.perf_counter() - start_time
        
        provider = config.get("configurable", {}).get("provider", "local")
        model = config.get("configurable", {}).get("model", "default")
        log_performance("LLM_REASONING", duration, {"provider": provider, "model": model})
        
        logger.info(f"LLM Response received (length: {len(response.content)}) in {duration:.2f}s")
    except Exception as e:
        err_msg = str(e)
        logger.error(f"LLM Invocation failed: {err_msg}")
        if "connection" in err_msg.lower() or "11434" in err_msg:
            raise Exception("AICodex: Connection to Ollama failed. Ensure Ollama is running (ollama serve).")
        raise e
    
    # Extract tool calls if any
    tool_calls = getattr(response, "tool_calls", [])
    if tool_calls:
        logger.info(f"Detected {len(tool_calls)} tool calls")
    
    return {
        "messages": [response],
        "current_tool_calls": tool_calls,
        "context_data": context_stats
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
