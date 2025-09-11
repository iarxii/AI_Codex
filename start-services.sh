#!/bin/bash

# This script starts all the necessary services for the AI_Codex project.

# Start the MCP server with the inspector in a new window
echo "Starting MCP server with inspector..."
cd mcp && start "MCP Inspector" cmd /c "npm run server:inspect" && cd ..

# Start the main application server in a new window
echo "Starting main application server..."
cd server && start "Main Server" cmd /c "npm run server" && cd ..

echo "All services are starting in separate windows."
