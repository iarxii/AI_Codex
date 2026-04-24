import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage, AIMessage

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
                
                # 4. Execute graph
                async for event in agent_graph.astream(initial_state):
                    for node_name, state_update in event.items():
                        if "messages" in state_update:
                            new_msg = state_update["messages"][-1]
                            if isinstance(new_msg, AIMessage):
                                # Token-like streaming if content is new
                                # Note: LangGraph often returns full message in state update
                                # For simplicity, we'll send the latest message content
                                full_ai_response = new_msg.content
                                await websocket.send_json({
                                    "type": "token",
                                    "content": new_msg.content,
                                    "node": node_name
                                })
                        
                        if "current_tool_calls" in state_update and state_update["current_tool_calls"]:
                            await websocket.send_json({
                                "type": "tool_call",
                                "tool_calls": state_update["current_tool_calls"],
                                "node": node_name
                            })

                # 5. Persist AI Response
                if full_ai_response:
                    new_ai_msg = Message(
                        conversation_id=conversation_id,
                        role="assistant",
                        content=full_ai_response
                    )
                    db.add(new_ai_msg)
                    await db.commit()

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
