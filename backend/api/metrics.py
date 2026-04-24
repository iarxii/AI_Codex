import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.integrations.ollamaopt_bridge import get_metrics_collector

router = APIRouter()
MetricsCollector = get_metrics_collector()

@router.websocket("/ws/metrics")
async def metrics_endpoint(websocket: WebSocket):
    print(f"DEBUG: WebSocket connection attempt on /ws/metrics")
    await websocket.accept()
    print(f"DEBUG: WebSocket connected on /ws/metrics")
    
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
                metrics_data["cpu"] = snapshot.get("system", {}).get("cpu_percent", 0)
                metrics_data["ram"] = snapshot.get("system", {}).get("memory_percent", 0)
                metrics_data["npu"] = snapshot.get("system", {}).get("npu_percent", 15) # Fallback to 15 if not present
                metrics_data["model"] = snapshot.get("model", {}).get("name", "Llama 3.2 3B")
                metrics_data["latency"] = f"{int(snapshot.get('performance', {}).get('latency_ms', 42))}ms"
            
            await websocket.send_json(metrics_data)
            await asyncio.sleep(2) # Stream every 2 seconds
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Metrics WS Error: {e}")
