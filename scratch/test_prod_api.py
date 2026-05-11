
import requests
import json

BASE_URL = "https://aicodex-be-5yrzhangwq-uc.a.run.app"

def test_api():
    print(f"Testing API at: {BASE_URL}")
    
    # 1. Login
    login_url = f"{BASE_URL}/api/auth/login"
    payload = {"username": "admin", "password": "admin123"}
    
    try:
        print(f"Logging in to {login_url}...")
        res = requests.post(login_url, data=payload) 
        if res.status_code != 200:
            print(f"Login failed: {res.status_code} - {res.text}")
            return
            
        token = res.json()["access_token"]
        print("Login success.")
        
        # 2. Get Spaces
        spaces_url = f"{BASE_URL}/api/spaces/"
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"Fetching spaces from {spaces_url}...")
        res = requests.get(spaces_url, headers=headers)
        if res.status_code != 200:
            print(f"Get spaces failed: {res.status_code} - {res.text}")
            return
            
        spaces = res.json()
        print(f"Found {len(spaces)} spaces:")
        for s in spaces:
            print(f"- {s['slug']}: {s['name']} (Config: {s.get('config_json')})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
