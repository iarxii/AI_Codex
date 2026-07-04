#!/bin/bash
# AI_Codex project setup script

set -e

echo "=== Setting up AI_Codex ==="

# 1. Setup Backend Python Virtual Environment
if [ -d "backend" ]; then
  echo "Setting up Python virtual environment in backend/..."
  cd backend
  python3 -m venv .venv
  source .venv/bin/activate || source .venv/Scripts/activate
  pip install -r requirements.txt
  cd ..
else
  echo "[WARNING] Backend directory not found."
fi

# 2. Setup Client Frontend Dependencies
if [ -d "client" ]; then
  echo "Installing client dependencies..."
  cd client
  npm install
  cd ..
else
  echo "[WARNING] Client directory not found."
fi

# 3. Setup MCP dependencies (if present)
if [ -d "mcp" ] && [ -f "mcp/package.json" ]; then
  echo "Installing MCP dependencies..."
  cd mcp
  npm install
  cd ..
fi

echo "=== Setup Complete ==="
