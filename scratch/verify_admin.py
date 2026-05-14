import asyncio
import httpx

API_BASE = "https://aicodex-be-5yrzhangwq-uc.a.run.app/api"

async def test_admin_login():
    print(f"Testing login for nexus-architect at {API_BASE}")
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{API_BASE}/auth/login", data={
            "username": "nexus-architect",
            "password": "GOD_MODE_ON"
        })
        
        if resp.status_code == 200:
            token = resp.json()["access_token"]
            print("Login SUCCESS!")
            
            # Verify role
            resp_me = await client.get(f"{API_BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
            if resp_me.status_code == 200:
                profile = resp_me.json()
                print(f"User: {profile['username']}, Role: {profile['profile']['role']}")
            else:
                print(f"Failed to fetch profile: {resp_me.status_code} {resp_me.text}")
        else:
            print(f"Login FAILED: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_admin_login())
