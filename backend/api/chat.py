import json
import time
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import List, Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from backend.utils.logger import log_debug, log_error
from backend.api.auth import get_user_from_token

from datetime import datetime
from backend.db.session import get_db, AsyncSessionLocal
from backend.db.models import Conversation, Message
from backend.agent.graph import create_agent_graph
from sqlalchemy import select, update

router = APIRouter()

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
            await websocket.close(code=4401) # Unauthorized
            manager.disconnect(websocket)
            return
            
    print(f"DEBUG: WebSocket connected on /ws/agent for user: {user.username}")
    try:
        while True:
            try:
                data = await websocket.receive_text()
                # Log only keys of the payload, not the values (to protect API keys)
                try:
                    p_preview = json.loads(data)
                    safe_preview = {k: "********" if "key" in k.lower() or "token" in k.lower() else v for k, v in p_preview.items()}
                    log_debug(f"Received WS payload: {list(safe_preview.keys())}")
                except:
                    pass
            except WebSocketDisconnect:
                print("DEBUG: WebSocket client disconnected gracefully")
                break
            except Exception as e:
                print(f"DEBUG: WebSocket receive error: {e}")
                break
                
            payload = json.loads(data)
            user_message = payload.get("message")
            conversation_id = payload.get("conversation_id")
            provider = payload.get("provider", "local")
            model = payload.get("model")
            api_key = payload.get("api_key")
            base_url = payload.get("base_url")
            
            if not conversation_id:
                await websocket.send_json({"type": "error", "message": "conversation_id is required"})
                continue

            async with AsyncSessionLocal() as db:
                # 1. Load History
                history_result = await db.execute(
                    select(Message)
                    .filter_by(conversation_id=conversation_id)
                    .order_by(Message.created_at)
                )
                history_msgs = history_result.scalars().all()
                
                langchain_history = []
                for m in history_msgs:
                    if m.role == "user":
                        langchain_history.append(HumanMessage(content=m.content))
                    elif m.role == "assistant":
                        langchain_history.append(AIMessage(content=m.content))
                
                # 2. Persist User Message
                new_user_msg = Message(
                    conversation_id=conversation_id,
                    role="user",
                    content=user_message
                )
                db.add(new_user_msg)
                
                # Update conversation timestamp
                await db.execute(
                    update(Conversation)
                    .where(Conversation.id == conversation_id)
                    .values(updated_at=datetime.utcnow())
                )
                await db.commit()

                # 3. Initial state for Graph
                initial_state = {
                    "messages": langchain_history + [HumanMessage(content=user_message)],
                    "current_tool_calls": [],
                    "context_data": {},
                    "routing_decision": {},
                    "is_complete": False
                }
                
                full_ai_response = ""
                
                # 4. Execute graph with event streaming
                log_debug(f"Starting graph execution for conv {conversation_id}")
                
                config = {
                    "configurable": {
                        "provider": provider, 
                        "model": model, 
                        "api_key": api_key,
                        "base_url": base_url
                    },
                    "recursion_limit": 10 # Prevent runaway loops
                }
                request_start = time.perf_counter()
                
                try:
                    async for event in agent_graph.astream_events(initial_state, config=config, version="v2"):
                        kind = event["event"]
                        node_name = event.get("metadata", {}).get("langgraph_node", "unknown")
                        
                        # Pipeline monitoring in terminal and UI
                        # We use on_chain_start and check if the name matches the node_name to avoid graph-level events
                        if kind == "on_chain_start" and node_name != "unknown" and event.get("name") == node_name:
                            print(f"\nPIPELINE: Entering node [{node_name}]")
                            await websocket.send_json({
                                "type": "status",
                                "status": f"Agent working in node: {node_name}",
                                "node": node_name,
                                "duration": time.perf_counter() - request_start
                            })
                        
                        # Log tokens (briefly to terminal)
                        if kind == "on_chat_model_stream":
                            content = event["data"]["chunk"].content
                            if content:
                                full_ai_response += content
                                # Print token to terminal for real-time monitoring
                                print(content, end="", flush=True)
                                
                                await websocket.send_json({
                                    "type": "token",
                                    "content": full_ai_response,
                                    "node": node_name,
                                    "duration": time.perf_counter() - request_start
                                })
                        
                        # Tool Calls or Final Response
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
                        # This is the most reliable way to get the AI response when
                        # on_chat_model_stream events don't fire (e.g., local provider)
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
                                            "duration": time.perf_counter() - request_start
                                        })
                                        break

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
                        # Truncate very long error messages
                        friendly_msg = error_str[:250] + "..."
                    
                    await websocket.send_json({"type": "error", "message": f"Execution Error: {friendly_msg}"})
                finally:
                    # 5. Persist AI Response
                    if full_ai_response:
                        new_ai_msg = Message(
                            conversation_id=conversation_id,
                            role="assistant",
                            content=full_ai_response
                        )
                        db.add(new_ai_msg)
                        await db.commit()
                        
                        duration = time.perf_counter() - request_start
                        print(f"\nPIPELINE: Finished in {duration:.2f}s")
                        print(f"PIPELINE: Agent Thought Result: {full_ai_response[:100]}...")
                        
                        # Reset status in UI
                        await websocket.send_json({
                            "type": "status",
                            "status": "Ready",
                            "node": "idle"
                        })

                    await websocket.send_json({"type": "done"})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        log_error("WS General Error", e)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
        manager.disconnect(websocket)

@router.post("/chat")
async def simple_chat(payload: dict):
    return {"bot": "Simple chat not implemented yet, use WebSocket for agent."}
