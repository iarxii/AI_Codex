import asyncio
import httpx

API_BASE = "http://localhost:8000/api"

async def run_tests():
    print("--- Starting E2E Registration Tests ---")
    
    # We will use httpx.AsyncClient
    async with httpx.AsyncClient(base_url=API_BASE) as client:
        
        print("\nTest 1: Normal Registration")
        resp = await client.post("/auth/register", json={
            "username": "test_user_1",
            "password": "password123",
            "email": "test1@example.com",
            "phone": "+123456789"
        })
        if resp.status_code == 200:
            print("PASS - Successfully registered test_user_1")
        elif resp.status_code == 400 and "already registered" in resp.text:
            print("SKIP - test_user_1 already registered (from previous run)")
        else:
            print(f"FAIL - Unexpected response: {resp.status_code} {resp.text}")

        print("\nTest 2: Duplicate Username")
        resp = await client.post("/auth/register", json={
            "username": "test_user_1",
            "password": "password123",
            "email": "test_dup1@example.com",
            "phone": "+1234567890"
        })
        if resp.status_code == 400 and "Username already registered" in resp.text:
            print("PASS - Correctly rejected duplicate username")
        else:
            print(f"FAIL - Failed to reject duplicate username: {resp.status_code} {resp.text}")

        print("\nTest 3: Duplicate Email")
        resp = await client.post("/auth/register", json={
            "username": "test_user_2",
            "password": "password123",
            "email": "test1@example.com",
            "phone": "+987654321"
        })
        if resp.status_code == 400 and "Email already registered" in resp.text:
            print("PASS - Correctly rejected duplicate email")
        else:
            print(f"FAIL - Failed to reject duplicate email: {resp.status_code} {resp.text}")

        print("\nTest 4: Restricted nexus-architect variation 1 (nexusarchitect)")
        resp = await client.post("/auth/register", json={
            "username": "nexusarchitect",
            "password": "password123",
            "email": "nexus1@example.com",
        })
        if resp.status_code == 400 and "strictly reserved" in resp.text:
            print("PASS - Correctly rejected 'nexusarchitect'")
        else:
            print(f"FAIL - Failed to reject 'nexusarchitect': {resp.status_code} {resp.text}")
            
        print("\nTest 5: Restricted nexus-architect variation 2 (Nexus_Architect)")
        resp = await client.post("/auth/register", json={
            "username": "Nexus_Architect",
            "password": "password123",
            "email": "nexus2@example.com",
        })
        if resp.status_code == 400 and "strictly reserved" in resp.text:
            print("PASS - Correctly rejected 'Nexus_Architect'")
        else:
            print(f"FAIL - Failed to reject 'Nexus_Architect': {resp.status_code} {resp.text}")

        print("\nTest 6: Restricted nexus-architect variation 3 (n e x u s - architect)")
        resp = await client.post("/auth/register", json={
            "username": "n e x u s - architect",
            "password": "password123",
            "email": "nexus3@example.com",
        })
        if resp.status_code == 400 and "strictly reserved" in resp.text:
            print("PASS - Correctly rejected 'n e x u s - architect'")
        else:
            print(f"FAIL - Failed to reject 'n e x u s - architect': {resp.status_code} {resp.text}")
            
    print("\n--- E2E Tests Complete ---")

if __name__ == "__main__":
    asyncio.run(run_tests())
