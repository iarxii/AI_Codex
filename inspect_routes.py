import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

from backend.main import app

for route in app.routes:
    if hasattr(route, 'path'):
        print(f"Path: {route.path}, Methods: {getattr(route, 'methods', 'N/A')}")
    elif hasattr(route, 'name'):
        print(f"Mount: {route.name}")
