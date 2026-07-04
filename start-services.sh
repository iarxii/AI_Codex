#!/bin/bash

# This script starts all the necessary services for the AI_Codex project.
# It aligns with start_website_dev.bat local mode execution.

echo "Starting Docker containers (PostgreSQL + pgvector)..."
docker-compose up -d

# Start backend service
echo "Starting FastAPI Backend on port 9000..."
export PYTHONPATH=.
source backend/.venv/bin/activate || source backend/.venv/Scripts/activate
uvicorn backend.main:app --reload --reload-dir backend --host 0.0.0.0 --port 9000 &

BACKEND_PID=$!

# Start client/frontend service
echo "Starting React Frontend..."
cd client
npm run dev &
CLIENT_PID=$!
cd ..

# Handle graceful shutdown of both background processes
trap "kill $BACKEND_PID $CLIENT_PID; exit" INT TERM EXIT

echo "All services are running. Press Ctrl+C to stop."
wait
