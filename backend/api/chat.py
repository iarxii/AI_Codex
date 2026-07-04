import json
import time
import logging
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import List, Annotated, Set
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from backend.utils.logger import log_debug, log_error
from backend.api.auth import get_user_from_token, get_current_user
from backend.utils.telemetry import get_model_capabilities, estimate_tokens

from datetime import datetime
from backend.db.session import get_db, AsyncSessionLocal
from backend.db.models import Conversation, Message, CodexSpace, CodexSpaceAccess
from backend.agent.graph import create_agent_graph
from codex_spaces.backend.agent.space_config import get_space_config
from sqlalchemy import select, update

router = APIRouter()

async def generate_cloud_chat_title(conversation_id: int, first_message: str, provider: str, model: str, api_key: str):
    """Generates a 3-5 word title using the cloud LLM and updates the Conversation."""
    try:
        from backend.agent.models import get_llm
        llm = get_llm(provider=provider, model=model, api_key=api_key)
        prompt = f"Summarize the following text in a short 3-5 word title. Output ONLY the title, no quotes or prefix.\n\nText: {first_message}"
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        title = response.content.strip().strip('"').strip("'")
        
        if title:
            async with AsyncSessionLocal() as db:
                await db.execute(update(Conversation).where(Conversation.id == conversation_id).values(title=title))
                await db.commit()
    except Exception as e:
        log_error(f"Failed to generate cloud title for conv {conversation_id}: {e}", e)

# Rate limiting state (In-memory for simplicity)
# user_id -> last_request_timestamp
user_cooldowns: dict[int, float] = {}
RATE_LIMIT_SECONDS = 1.5

# Simple connection manager for WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

manager = ConnectionManager()
agent_graph = create_agent_graph()

@router.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    print(f"DEBUG: WebSocket connection attempt on /ws/agent (token: {'present' if token else 'missing'})")
    await manager.connect(websocket)
    
    # WebSocket Authentication
    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user:
            log_error("WS Auth Failed: Invalid or missing token", None)
            await websocket.send_json({"type": "error", "message": "Authentication failed. Invalid token."})
            await websocket.close(code=4401)
            manager.disconnect(websocket)
            return

        # 2. Premium Handshake Verification (Secondary Security Layer)
        from backend.config import settings
        if settings.COLAB_SECRET:
            # Check for handshake in query params (for WS) or headers
            handshake = websocket.query_params.get("handshake")
            if handshake != settings.COLAB_SECRET:
                log_error(f"WS Handshake Failed for user {user.username}: Invalid secret", None)
                await websocket.send_json({"type": "error", "message": "Premium Handshake Failed: Invalid security key."})
                await websocket.close(code=4003) # Forbidden
                manager.disconnect(websocket)
                return
            
    print(f"DEBUG: WebSocket connected on /ws/agent for user: {user.username}")
    active_tasks: Set[asyncio.Task] = set()
    client_tool_responses = asyncio.Queue()

    async def run_agent_task(payload_data):
        conversation_id = payload_data.get("conversation_id")
        user_message = payload_data.get("message")
        provider = payload_data.get("provider")
        model = payload_data.get("model")
        api_key = payload_data.get("api_key")
        api_keys = payload_data.get("api_keys")
        if not isinstance(api_keys, dict):
            api_keys = {}
        base_url = payload_data.get("base_url")
        model_config = payload_data.get("config", {})
        agent_mode = payload_data.get("agent_mode", True)
        local_backend_mode = payload_data.get("local_backend_mode", "ollama")
        # LangSmith Telemetry Configuration
        benchmark_mode = payload_data.get("benchmark_mode", False)
        private_workspace = payload_data.get("private_workspace", True)
        langsmith_api_key = payload_data.get("langsmith_api_key")
        langsmith_project = payload_data.get("langsmith_project", "vscode-agent-react-benchmarks")

        enable_tracing = benchmark_mode and not private_workspace and bool(langsmith_api_key)
        
        ls_client = None
        if enable_tracing:
            import langsmith as ls
            
            def scrub_telemetry_payload(inputs: dict) -> dict:
                if not inputs or not isinstance(inputs, dict):
                    return inputs
                scrubbed = inputs.copy()
                for key, val in list(scrubbed.items()):
                    if isinstance(val, str) and len(val) > 1000:
                        scrubbed[key] = val[:500] + "\n... [TRUNCATED FOR TELEMETRY SAVINGS] ...\n" + val[-500:]
                if "messages" in scrubbed and isinstance(scrubbed["messages"], list):
                    processed_msgs = []
                    for msg in scrubbed["messages"]:
                        if isinstance(msg, dict):
                            content = msg.get("content")
                            if isinstance(content, str) and len(content) > 1000:
                                msg = msg.copy()
                                msg["content"] = content[:500] + "\n... [TRUNCATED FOR TELEMETRY SAVINGS] ...\n" + content[-500:]
                        elif hasattr(msg, "content"):
                            content = msg.content
                            if isinstance(content, str) and len(content) > 1000:
                                truncated = content[:500] + "\n... [TRUNCATED FOR TELEMETRY SAVINGS] ...\n" + content[-500:]
                                try:
                                    msg = msg.__class__(
                                        content=truncated,
                                        **{k: v for k, v in msg.__dict__.items() if k not in ["content", "id", "type"]}
                                    )
                                except Exception:
                                    pass
                        processed_msgs.append(msg)
                    scrubbed["messages"] = processed_msgs
                return scrubbed

            try:
                ls_client = ls.Client(
                    api_key=langsmith_api_key,
                    hide_inputs=scrub_telemetry_payload,
                    hide_outputs=scrub_telemetry_payload
                )
                print(f"PIPELINE: Dynamic LangSmith Tracing Client initialized for project '{langsmith_project}'")
            except Exception as e:
                print(f"PIPELINE ERROR: Failed to initialize LangSmith Client: {e}")
                enable_tracing = False
        
        if not conversation_id:
            await websocket.send_json({"type": "error", "message": "conversation_id is required"})
            return

        request_start = time.perf_counter()
        full_ai_response = ""
        history_len = 0
        final_messages = None

        try:
            async with AsyncSessionLocal() as db:
                # 0. Get Conversation space_type and Verify Access
                conv_result = await db.execute(select(Conversation).filter_by(id=conversation_id))
                conversation = conv_result.scalar_one_or_none()
                if not conversation:
                    await websocket.send_json({"type": "error", "message": "Conversation not found"})
                    return
                
                space_type = conversation.space_type
                
                if space_type != "general":
                    space_res = await db.execute(select(CodexSpace).filter_by(slug=space_type, is_active=True))
                    space = space_res.scalar_one_or_none()
                    if not space:
                        await websocket.send_json({"type": "error", "message": "Space not found"})
                        return
                    
                    is_admin = user.role in ["admin", "super_admin"]
                    if not is_admin and not space.is_public:
                        access_res = await db.execute(select(CodexSpaceAccess).filter_by(space_id=space.id, user_id=user.id))
                        if not access_res.scalar_one_or_none():
                            await websocket.send_json({"type": "error", "message": "Access denied to this space"})
                            return
                
                s_config = get_space_config(space_type)
                
                # Apply provider/model recommendations if not explicitly provided by user
                if not provider and s_config.get("recommended_provider"):
                    provider = s_config["recommended_provider"]
                    print(f"PIPELINE: Using recommended provider [{provider}] for space [{space_type}]")
                
                if not model and s_config.get("recommended_model"):
                    model = s_config["recommended_model"]
                    print(f"PIPELINE: Using recommended model [{model}] for space [{space_type}]")

                # Default fallback
                provider = provider or "local"

                # Extract correct API key for the resolved provider
                if provider != "local":
                    # Priority: api_keys map > legacy api_key field
                    # Robust key resolution
                    print(f"PIPELINE: Resolving key for provider [{provider}]. Available map keys: {list(api_keys.keys())}")
                    
                    provider_key = api_keys.get(provider)
                    if not provider_key and api_key:
                        print(f"PIPELINE: Key not found in map for [{provider}], falling back to legacy field.")
                        provider_key = api_key
                        
                    if provider_key and str(provider_key).strip():
                        api_key = str(provider_key).strip()
                        api_keys[provider] = api_key
                        masked_key = f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "****"
                        print(f"PIPELINE: Successfully resolved API key for [{provider}]: {masked_key}")
                    else:
                        api_key = None
                        print(f"PIPELINE CRITICAL: No valid API key found for resolved provider [{provider}]")

                # 1. Load History
                client_messages = payload_data.get("messages")
                save_to_db = payload_data.get("save_to_db", True)
                if client_messages is not None:
                    save_to_db = False

                from langchain_core.messages import (
                    HumanMessage as _HumanMessage, 
                    AIMessage as _AIMessage, 
                    ToolMessage as _ToolMessage, 
                    SystemMessage as _SystemMessage
                )
                langchain_history = []
                
                if client_messages is not None:
                    print(f"PIPELINE: Loading history from client payload ({len(client_messages)} messages)")
                    for m in client_messages:
                        role = m.get("role")
                        content = m.get("content", "")
                        meta = m.get("metadata") or {}
                        
                        if role == "user":
                            langchain_history.append(_HumanMessage(content=content))
                        elif role == "assistant":
                            tool_calls = meta.get("tool_calls", [])
                            langchain_history.append(_AIMessage(content=content, tool_calls=tool_calls))
                        elif role == "tool":
                            langchain_history.append(_ToolMessage(
                                content=content,
                                name=meta.get("name", ""),
                                tool_call_id=meta.get("tool_call_id", "")
                            ))
                        elif role == "system":
                            langchain_history.append(_SystemMessage(content=content))
                else:
                    # 1. Load History from DB
                    history_result = await db.execute(
                        select(Message)
                        .filter_by(conversation_id=conversation_id)
                        .order_by(Message.created_at)
                    )
                    history_msgs = history_result.scalars().all()
                    
                    for m in history_msgs:
                        meta = {}
                        if m.metadata_json:
                            try:
                                meta = json.loads(m.metadata_json)
                            except Exception:
                                pass
                                
                        if m.role == "user":
                            langchain_history.append(_HumanMessage(content=m.content))
                        elif m.role == "assistant":
                            tool_calls = meta.get("tool_calls", [])
                            langchain_history.append(_AIMessage(content=m.content, tool_calls=tool_calls))
                        elif m.role == "tool":
                            langchain_history.append(_ToolMessage(
                                content=m.content,
                                name=meta.get("name", ""),
                                tool_call_id=meta.get("tool_call_id", "")
                            ))
                        elif m.role == "system":
                            langchain_history.append(_SystemMessage(content=m.content))
                
                # 2. Persist User Message
                history_len = len(langchain_history) + 1
                user_message_str = str(user_message) if user_message is not None else ""
                
                if history_len == 1 and conversation.title == "New Conversation":
                    # Generate Title async in background
                    asyncio.create_task(generate_cloud_chat_title(conversation_id, user_message_str, provider, model, api_key))
                
                if save_to_db:
                    new_user_msg = Message(
                        conversation_id=conversation_id,
                        role="user",
                        content=user_message_str
                    )
                    db.add(new_user_msg)
                    
                    # Update conversation timestamp
                    await db.execute(
                        update(Conversation)
                        .where(Conversation.id == conversation_id)
                        .values(updated_at=datetime.utcnow())
                    )
                    await db.commit()
                
                config = {
                    "configurable": {
                        "provider": provider, 
                        "model": model, 
                        "api_key": api_key,
                        "api_keys": api_keys,
                        "base_url": base_url,
                        "model_config": model_config,
                        "conversation_id": str(conversation_id),
                        "agent_mode": agent_mode,
                        "local_backend_mode": local_backend_mode,
                        "user_id": user.id,
                        "space_slug": space_type,
                        "client_type": payload_data.get("client_type"),
                        "websocket": websocket,
                        "client_tool_responses": client_tool_responses
                    },
                    "recursion_limit": 100
                }
                
                # Early Auth Check for Cloud Providers
                if provider in ["groq", "openrouter", "gemini", "ollama_cloud"]:
                    api_key = config.get("configurable", {}).get("api_key")
                    
                    is_missing = not api_key or (provider == "ollama_cloud" and api_key == "sk-ollama")
                    if is_missing:
                        p_label = provider.capitalize() if provider != "ollama_cloud" else "Ollama Cloud"
                        full_ai_response = f"❌ **{p_label} API Key Missing**\nPlease open the **Settings** (gear icon) and add your API key for {p_label} to enable this Neural core."
                        await websocket.send_json({"type": "token", "content": full_ai_response, "node": "auth_check", "provider": provider, "model": model, "duration": 0})
                        return

                # 3. Initial state for Graph
                initial_messages = langchain_history.copy()
                scratchpad_data = payload_data.get("scratchpad") or {}
                retrieved_chunks = scratchpad_data.get("retrieved_chunks")
                if retrieved_chunks:
                    context_msg = "Here are the most relevant code snippets from the local codebase (semantic search results):\n\n"
                    for idx, chunk in enumerate(retrieved_chunks):
                        context_msg += f"[{idx + 1}] File: {chunk.get('file')} (Lines {chunk.get('lines')})\n"
                        context_msg += f"```\n{chunk.get('content')}\n```\n\n"
                    initial_messages.append(_SystemMessage(content=context_msg))
                initial_messages.append(_HumanMessage(content=user_message_str))

                initial_state = {
                    "messages": initial_messages,
                    "current_tool_calls": [],
                    "context_data": {},
                    "routing_decision": {},
                    "is_complete": False,
                    "telemetry": {
                        "request_id": str(datetime.utcnow().timestamp()),
                        "ttft": 0,
                        "total_tokens": 0,
                        "usage": {"input": 0, "output": 0},
                        "latencies": {},
                        "capabilities": get_model_capabilities(provider, model),
                        "provider": provider,
                        "model": model
                    },
                    "space_config": s_config,
                    "scratchpad": payload_data.get("scratchpad") or {}
                }
                
                # 4. Execute graph with event streaming
                log_debug(f"Starting graph execution for conv {conversation_id}")
                
                if provider == "local" and local_backend_mode == "llamacpp":
                    # NativeLocalClient streaming — only in llamacpp mode
                    first_token_received = False
                    async def _token_callback(accumulated_content: str):
                        nonlocal full_ai_response, first_token_received
                        full_ai_response = accumulated_content
                        
                        now = time.perf_counter()
                        if not first_token_received:
                            first_token_received = True
                            initial_state["telemetry"]["ttft"] = now - request_start
                            await websocket.send_json({
                                "type": "telemetry",
                                "data": initial_state["telemetry"]
                            })

                        await websocket.send_json({
                            "type": "token",
                            "content": accumulated_content,
                            "node": "reason",
                            "provider": provider,
                            "model": model,
                            "duration": now - request_start
                        })
                    config["configurable"]["token_callback"] = _token_callback
                
                from langsmith.run_helpers import tracing_context
                with tracing_context(client=ls_client, project_name=langsmith_project, enabled=enable_tracing):
                    async for event in agent_graph.astream_events(initial_state, config=config, version="v2"):
                        kind = event["event"]
                        node_name = event.get("metadata", {}).get("langgraph_node", "unknown")
                    
                        # Pipeline monitoring — filter graph-level events
                        if kind == "on_chain_start" and node_name != "unknown" and event.get("name") == node_name:
                            print(f"\nPIPELINE: Entering node [{node_name}]")
                            await websocket.send_json({
                                "type": "status",
                                "status": f"Agent working in node: {node_name}",
                                "node": node_name,
                                "duration": time.perf_counter() - request_start
                            })
                    
                        if kind == "on_chat_model_stream":
                            content = event["data"]["chunk"].content
                            if content:
                                full_ai_response += content
                            
                                now = time.perf_counter()
                                if initial_state["telemetry"]["ttft"] == 0:
                                    initial_state["telemetry"]["ttft"] = now - request_start
                                    await websocket.send_json({
                                        "type": "telemetry",
                                        "data": initial_state["telemetry"]
                                    })

                                print(content, end="", flush=True)
                                await websocket.send_json({
                                    "type": "token",
                                    "content": full_ai_response,
                                    "node": node_name,
                                    "provider": provider,
                                    "model": model,
                                    "duration": now - request_start
                                })
                    
                        elif kind == "on_chat_model_end":
                            msg = event["data"]["output"]
                            if hasattr(msg, "tool_calls") and msg.tool_calls:
                                print(f"PIPELINE: Tool Call detected: {msg.tool_calls[0]['name']}")
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "tool_calls": msg.tool_calls,
                                    "node": node_name,
                                    "duration": time.perf_counter() - request_start
                                })
                            # Fallback: if no streaming tokens were captured but model returned content,
                            # send the full response as a single token (handles providers that don't stream)
                            elif hasattr(msg, "content") and msg.content and not full_ai_response:
                                full_ai_response = msg.content
                                print(f"\nPIPELINE: Non-streaming response captured ({len(msg.content)} chars)")
                                await websocket.send_json({
                                    "type": "token",
                                    "content": full_ai_response,
                                    "node": node_name,
                                    "provider": provider,
                                    "model": model,
                                    "duration": time.perf_counter() - request_start
                                })
                            
                        # Tool Results
                        elif kind == "on_tool_end":
                            print(f"PIPELINE: Tool Result: {str(event['data']['output'])[:50]}...")
                            await websocket.send_json({
                                "type": "tool_result",
                                "content": str(event["data"]["output"]),
                                "tool_call_id": event["metadata"].get("tool_call_id", "unknown"),
                                "node": node_name
                            })
                    
                        elif kind == "on_error":
                            error_obj = event.get("data", {}).get("error")
                            print(f"PIPELINE ERROR: {error_obj}")
                            await websocket.send_json({"type": "error", "message": f"Graph Error: {str(error_obj)}"})
                    
                        elif kind == "on_chain_end":
                            output = event.get("data", {}).get("output", {})
                            if isinstance(output, dict) and "messages" in output:
                                final_messages = output["messages"]
                            
                            if not full_ai_response and isinstance(output, dict):
                                msgs = output.get("messages", [])
                                for m in reversed(msgs):
                                    if hasattr(m, "content") and m.content and getattr(m, "type", "") == "ai":
                                        content = m.content
                                        if isinstance(content, list):
                                            # Extract text from content blocks (common with Gemini/Multimodal)
                                            text_parts = []
                                            for part in content:
                                                if isinstance(part, dict):
                                                    text_parts.append(part.get("text", ""))
                                                else:
                                                    text_parts.append(str(part))
                                            content = "".join(text_parts)
                                    
                                        full_ai_response = str(content)
                                        print(f"\nPIPELINE: Captured response from chain_end ({len(full_ai_response)} chars)")
                                        await websocket.send_json({
                                            "type": "token",
                                            "content": full_ai_response,
                                            "node": node_name,
                                            "provider": provider,
                                            "model": model,
                                            "duration": time.perf_counter() - request_start
                                        })
                                        break

        except asyncio.CancelledError:
            log_debug(f"Task cancelled for conversation {conversation_id}")
            await websocket.send_json({"type": "status", "status": "Cancelled", "node": "idle"})
            return  # Exit early — cancel handler already sends "done"
        except Exception as e:
            error_str = str(e)
            log_error(f"PIPELINE EXCEPTION for conv {conversation_id}", e)
            
            # Parse common error patterns into user-friendly messages
            friendly_msg = error_str
            if "429" in error_str or "rate" in error_str.lower():
                friendly_msg = "Rate limited by provider. Please wait a moment and try again, or switch to a different model."
            elif "401" in error_str or "unauthorized" in error_str.lower() or "invalid api key" in error_str.lower():
                friendly_msg = "Authentication failed. Please check your API key in Settings."
            elif "Cannot reach" in error_str or "ConnectError" in error_str or isinstance(e, ConnectionError):
                friendly_msg = f"Cannot connect to LLM server. {error_str}"
            elif "timed out" in error_str.lower() or "timeout" in error_str.lower():
                friendly_msg = "Request timed out. The model server may be overloaded or offline."
            elif "404" in error_str:
                friendly_msg = "Model not found on the provider. Please select a different model."
            elif len(error_str) > 300:
                friendly_msg = error_str[:250] + "..."
            
            await websocket.send_json({"type": "error", "message": f"Execution Error: {friendly_msg}"})
        finally:
            # Re-fetch or save all generated messages
            if save_to_db:
                async with AsyncSessionLocal() as db:
                    if final_messages and len(final_messages) > history_len:
                        # Save all new messages generated during the graph run
                        new_msgs_to_save = final_messages[history_len:]
                        for m in new_msgs_to_save:
                            role = getattr(m, "type", "assistant")
                            if role == "ai":
                                role_str = "assistant"
                            elif role == "human":
                                role_str = "user"
                            elif role == "tool":
                                role_str = "tool"
                            elif role == "system":
                                role_str = "system"
                            else:
                                role_str = str(role)
                                
                            meta = {}
                            if hasattr(m, "tool_calls") and m.tool_calls:
                                meta["tool_calls"] = m.tool_calls
                            if role == "tool":
                                meta["name"] = getattr(m, "name", "")
                                meta["tool_call_id"] = getattr(m, "tool_call_id", "")
                                
                            meta_json = json.dumps(meta) if meta else None
                            
                            new_db_msg = Message(
                                conversation_id=conversation_id,
                                role=role_str,
                                content=str(m.content),
                                metadata_json=meta_json
                            )
                            db.add(new_db_msg)
                        await db.commit()
                    elif full_ai_response:
                        # Fallback to save just the final response if graph run didn't finish normally
                        new_ai_msg = Message(
                            conversation_id=conversation_id,
                            role="assistant",
                            content=full_ai_response
                        )
                        db.add(new_ai_msg)
                        await db.commit()
                    
                # Send final telemetry
                initial_state["telemetry"]["latencies"]["total"] = time.perf_counter() - request_start
                if full_ai_response:
                    # Use utility for token estimation if not provided by model
                    initial_state["telemetry"]["usage"]["output"] = estimate_tokens(full_ai_response)
                    initial_state["telemetry"]["total_tokens"] = initial_state["telemetry"]["usage"]["input"] + initial_state["telemetry"]["usage"]["output"]

                await websocket.send_json({
                    "type": "telemetry",
                    "data": initial_state["telemetry"]
                })
                
                # Reset status in UI
                await websocket.send_json({
                    "type": "status",
                    "status": "Ready",
                    "node": "idle"
                })
            
            await websocket.send_json({"type": "done"})

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get("type") == "ping":
                # Heartbeat ping from client to keep connection alive
                continue
            
            if payload.get("type") == "tool_response":
                await client_tool_responses.put(payload)
                continue
            
            if payload.get("type") == "cancel":
                print("PIPELINE: Cancel signal received from client")
                for task in list(active_tasks):
                    if not task.done():
                        task.cancel()
                active_tasks.clear()
                continue
            
            # 3. Rate Limiting Check (Cooldown)
            now = time.time()
            last_req = user_cooldowns.get(user.id, 0)
            if now - last_req < RATE_LIMIT_SECONDS:
                await websocket.send_json({
                    "type": "error", 
                    "message": f"Neural Link Throttled: Please wait {RATE_LIMIT_SECONDS}s between thoughts."
                })
                continue
            
            user_cooldowns[user.id] = now
            
            # Start agent execution in a background task
            agent_task = asyncio.create_task(run_agent_task(payload))
            active_tasks.add(agent_task)
            agent_task.add_done_callback(active_tasks.discard)
            
    except WebSocketDisconnect:
        for task in list(active_tasks):
            task.cancel()
        manager.disconnect(websocket)
    except Exception as e:
        log_error("WS General Error", e)
        manager.disconnect(websocket)

@router.post("/quick")
async def quick_chat(payload: dict, current_user = Depends(get_current_user)):
    system_context = payload.get("system_context", "")
    message = payload.get("message", "")
    
    provider = (payload.get("provider") or "ollama_cloud").lower()
    model_name = payload.get("model") or "default"
    api_key = payload.get("api_key", None)
    
    try:
        from backend.agent.models import get_llm
        model = get_llm(provider=provider, model=model_name, api_key=api_key)
        messages = [
            {"role": "system", "content": system_context},
            {"role": "user", "content": message}
        ]
        
        response = await model.ainvoke(messages)
        return {"reply": response.content}
    except Exception as e:
        log_error(f"Quick Chat Error: {str(e)}", e)
        return {"reply": f"Sorry, I encountered an error: {str(e)}"}
