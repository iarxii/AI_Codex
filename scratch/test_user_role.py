
import requests
import json

BASE_URL = "https://aicodex-be-5yrzhangwq-uc.a.run.app"

def test_user_role():
    print(f"Testing User Role at: {BASE_URL}")
    
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
        
        # 2. Get Me
        me_url = f"{BASE_URL}/api/auth/me"
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"Fetching user info from {me_url}...")
        res = requests.get(me_url, headers=headers)
        if res.status_code != 200:
            print(f"Get me failed: {res.status_code} - {res.text}")
            return
            
        data = res.json()
        print(f"User Role: {data['profile']['role']}")
        print(f"Full Data: {json.dumps(data, indent=2)}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_user_role()
