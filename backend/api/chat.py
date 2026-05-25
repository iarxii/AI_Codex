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
from backend.agent.space_config import get_space_config
from sqlalchemy import select, update

router = APIRouter()

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

    async def run_agent_task(payload_data):
        conversation_id = payload_data.get("conversation_id")
        user_message = payload_data.get("message")
        provider = payload_data.get("provider")
        model = payload_data.get("model")
        api_key = payload_data.get("api_key") # Legacy fallback
        api_keys = payload_data.get("api_keys", {}) # New multi-key support
        base_url = payload_data.get("base_url")
        model_config = payload_data.get("config", {})
        agent_mode = payload_data.get("agent_mode", True)
        local_backend_mode = payload_data.get("local_backend_mode", "ollama")
        
        if not conversation_id:
            await websocket.send_json({"type": "error", "message": "conversation_id is required"})
            return

        request_start = time.perf_counter()
        full_ai_response = ""

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
                        masked_key = f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "****"
                        print(f"PIPELINE: Successfully resolved API key for [{provider}]: {masked_key}")
                    else:
                        api_key = None
                        print(f"PIPELINE CRITICAL: No valid API key found for resolved provider [{provider}]")

                # 1. Load History
                history_result = await db.execute(
                    select(Message)
                    .filter_by(conversation_id=conversation_id)
                    .order_by(Message.created_at)
                )
                history_msgs = history_result.scalars().all()
                
                from langchain_core.messages import HumanMessage as _HumanMessage, AIMessage as _AIMessage
                langchain_history = []
                for m in history_msgs:
                    if m.role == "user":
                        langchain_history.append(_HumanMessage(content=m.content))
                    elif m.role == "assistant":
                        langchain_history.append(_AIMessage(content=m.content))
                
                # 2. Persist User Message
                user_message_str = str(user_message) if user_message is not None else ""
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
                
                config = {
                    "configurable": {
                        "provider": provider, 
                        "model": model, 
                        "api_key": api_key,
                        "base_url": base_url,
                        "model_config": model_config,
                        "conversation_id": str(conversation_id),
                        "agent_mode": agent_mode,
                        "local_backend_mode": local_backend_mode
                    },
                    "recursion_limit": 25
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

                await db.commit()

                # 3. Initial state for Graph
                initial_state = {
                    "messages": langchain_history + [_HumanMessage(content=user_message_str)],
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
                    "space_config": s_config
                }
                
                # 4. Execute graph with event streaming
                log_debug(f"Starting graph execution for conv {conversation_id}")
                
                config = {
                    "configurable": {
                        "provider": provider, 
                        "model": model, 
                        "api_key": api_key,
                        "base_url": base_url,
                        "model_config": model_config,
                        "conversation_id": str(conversation_id),
                        "agent_mode": agent_mode,
                        "local_backend_mode": local_backend_mode
                    },
                    "recursion_limit": 25
                }
                
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
                    
                    # Capture final response from graph chain_end state
                    # Most reliable way to get the AI response when on_chat_model_stream
                    # events don't fire (e.g., local provider)
                    elif kind == "on_chain_end" and not full_ai_response:
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict):
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
            # Persist AI Response
            if full_ai_response:
                async with AsyncSessionLocal() as db:
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
    from backend.agent.models import get_model
    system_context = payload.get("system_context", "")
    message = payload.get("message", "")
    
    provider = payload.get("provider", "groq")
    model_name = payload.get("model", "llama3-8b-8192")
    api_key = payload.get("api_key", None)
    
    try:
        model = get_model(provider=provider, model_name=model_name, api_key=api_key)
        messages = [
            {"role": "system", "content": system_context},
            {"role": "user", "content": message}
        ]
        
        response = await model.ainvoke(messages)
        return {"reply": response.content}
    except Exception as e:
        log_error(f"Quick Chat Error: {str(e)}", e)
        return {"reply": f"Sorry, I encountered an error: {str(e)}"}
