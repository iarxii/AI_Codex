import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage, AIMessage

from backend.db.session import get_db
from backend.agent.graph import create_agent_graph
from backend.config import settings

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
            
            # Initial state
            # TODO: Load history from DB
            initial_state = {
                "messages": [HumanMessage(content=user_message)],
                "current_tool_calls": [],
                "context_data": {},
                "routing_decision": {},
                "is_complete": False
            }
            
            # Execute graph
            async for event in agent_graph.astream(initial_state):
                # event is a dict of {node_name: {state_update}}
                for node_name, state_update in event.items():
                    # Stream tokens/events to UI
                    if "messages" in state_update:
                        new_msg = state_update["messages"][-1]
                        if isinstance(new_msg, AIMessage):
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

            await websocket.send_json({"type": "done"})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WS Error: {e}")
        await websocket.send_json({"type": "error", "message": str(e)})
        manager.disconnect(websocket)

@router.post("/chat")
async def simple_chat(payload: dict):
    # TODO: Implement simple direct Ollama call
    return {"bot": "Simple chat not implemented yet, use WebSocket for agent."}
