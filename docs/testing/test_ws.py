import asyncio
import json
import websockets
import httpx

async def test_provider(provider, model, api_key=""):
    r = httpx.post("http://localhost:8000/api/auth/login", data={"username": "admin", "password": "admin123"})
    token = r.json().get("access_token", "")
    
    headers = {"Authorization": f"Bearer {token}"}
    cr = httpx.post("http://localhost:8000/api/conversations/", json={"title": f"test_{provider}"}, headers=headers)
    conv_id = cr.json().get("id")
    
    uri = f"ws://localhost:8000/api/chat/ws/agent?token={token}"
    async with websockets.connect(uri) as ws:
        payload = {
            "message": "Hello",
            "conversation_id": conv_id,
            "provider": provider,
            "model": model,
            "api_key": api_key,
            "base_url": ""
        }
        print(f"\n=== Testing {provider} / {model} ===")
        await ws.send(json.dumps(payload))
        
        for i in range(50):
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=30.0)
                data = json.loads(msg)
                msg_type = data.get("type")
                if msg_type == "token":
                    content = data.get("content", "")
                    print(f"  [token] {content[:100]}")
                elif msg_type == "error":
                    print(f"  [ERROR] {data.get('message', '')[:150]}")
                elif msg_type == "done":
                    print(f"  [done]")
                    break
                elif msg_type == "status":
                    print(f"  [status] {data.get('status', '')}")
            except asyncio.TimeoutError:
                print(f"  [TIMEOUT]")
                break

async def main():
    # Test local
    await test_provider("local", "default")

asyncio.run(main())
