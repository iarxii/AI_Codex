import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from backend.integrations.ollamaopt_bridge import get_metrics_collector
from backend.api.auth import get_user_from_token
from backend.db.session import AsyncSessionLocal

router = APIRouter()
MetricsCollector = get_metrics_collector()

@router.websocket("/ws/metrics")
async def metrics_endpoint(websocket: WebSocket, token: str = Query(None)):
    print(f"DEBUG: WebSocket connection attempt on /ws/metrics")
    await websocket.accept()
    
    # WebSocket Authentication
    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.send_json({"type": "error", "message": "Authentication failed"})
            await websocket.close(code=4401)
            return

    print(f"DEBUG: WebSocket connected on /ws/metrics for user: {user.username}")
    
    # Get the global collector instance
    from backend.integrations.ollamaopt_bridge import get_ollamaopt_module
    metrics_module = get_ollamaopt_module("metrics_collector")
    
    collector = None
    if metrics_module:
        collector = getattr(metrics_module, "get_collector", lambda: None)()
        if collector:
            # Ensure it's started
            collector.start()
        
    try:
        while True:
            # Default metrics
            metrics_data = {
                "cpu": 0,
                "ram": 0,
                "npu": 0,
                "model": "Llama 3.2 3B",
                "latency": "42ms"
            }
            
            if collector:
                snapshot = collector.get_snapshot()
                system = snapshot.get("system", {})
                metrics_data["cpu"] = system.get("cpu_percent", 0)
                metrics_data["ram"] = system.get("memory_percent", 0)
                metrics_data["npu"] = system.get("npu_percent", 0)
                metrics_data["npu_available"] = system.get("npu_available", False)
                metrics_data["igpu"] = system.get("vram_percent", system.get("igpu_percent", 0))
                metrics_data["igpu_available"] = system.get("igpu_available", False)
                
                model_info = snapshot.get("model", {})
                model_name = model_info.get("name")
                if model_name and model_name.upper() != "NONE":
                    metrics_data["model"] = model_name
                
                perf = snapshot.get('performance', {})
                latency = perf.get('latency_ms')
                if latency:
                    metrics_data["latency"] = f"{int(latency)}ms"
            
            await websocket.send_json(metrics_data)
            await asyncio.sleep(2) # Stream every 2 seconds
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Metrics WS Error: {e}")
