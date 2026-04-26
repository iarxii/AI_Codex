import json
import time
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from backend.utils.logger import log_debug, log_error

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
        self.active_connections.remove(websocket)

manager = ConnectionManager()
agent_graph = create_agent_graph()

@router.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            user_message = payload.get("message")
            conversation_id = payload.get("conversation_id")
            provider = payload.get("provider", "local")
            model = payload.get("model")
            api_key = payload.get("api_key")
            
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
                
                config = {"configurable": {"provider": provider, "model": model, "api_key": api_key}}
                request_start = time.perf_counter()
                
                try:
                    async for event in agent_graph.astream_events(initial_state, config=config, version="v2"):
                        kind = event["event"]
                        node_name = event.get("metadata", {}).get("langgraph_node", "unknown")
                        
                        log_debug(f"Event: {kind} | Node: {node_name}")
                        
                        # Log tokens
                        if kind == "on_chat_model_stream":
                            content = event["data"]["chunk"].content
                            if content:
                                full_ai_response += content
                                await websocket.send_json({
                                    "type": "token",
                                    "content": full_ai_response,
                                    "node": node_name,
                                    "duration": time.perf_counter() - request_start
                                })
                        
                        # Log node transitions for "Working" indicator
                        elif kind == "on_chain_start" and "metadata" in event and "langgraph_node" in event["metadata"]:
                            await websocket.send_json({
                                "type": "status",
                                "status": f"Agent working in node: {event['metadata']['langgraph_node']}",
                                "node": event['metadata']['langgraph_node']
                            })
                        
                        # Tool Calls
                        elif kind == "on_chat_model_end":
                            msg = event["data"]["output"]
                            if hasattr(msg, "tool_calls") and msg.tool_calls:
                                log_debug(f"Tool Call detected: {msg.tool_calls}")
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "tool_calls": msg.tool_calls,
                                    "node": node_name,
                                    "duration": time.perf_counter() - request_start
                                })
                                
                        # Tool Results
                        elif kind == "on_tool_end":
                            log_debug(f"Tool Result detected: {event['data']['output'][:100]}...")
                            await websocket.send_json({
                                "type": "tool_result",
                                "content": str(event["data"]["output"]),
                                "tool_call_id": event["metadata"].get("tool_call_id", "unknown"),
                                "node": node_name
                            })
                        
                        elif kind == "on_error":
                            log_error(f"Graph Error in {node_name}", event.get("data", {}).get("error"))
                            await websocket.send_json({"type": "error", "message": f"Graph Error: {event.get('data', {}).get('error')}"})
                except Exception as e:
                    log_error(f"Streaming Exception for conv {conversation_id}", str(e))
                    await websocket.send_json({"type": "error", "message": f"Execution Error: {str(e)}"})
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
                        log_debug(f"Persisted AI response for conv {conversation_id}")

                    await websocket.send_json({"type": "done"})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WS Error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
        manager.disconnect(websocket)

@router.post("/chat")
async def simple_chat(payload: dict):
    return {"bot": "Simple chat not implemented yet, use WebSocket for agent."}
