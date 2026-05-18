#!/bin/bash

# Start the Gree AC Web Controller
echo "Starting Gree AC Web Controller..."

# Navigate to the project root
cd "$(dirname "$0")"

# Check if frontend is built
if [ ! -d "frontend/dist" ]; then
    echo "Frontend not built. Building now..."
    cd frontend && npm install && npm run build
    cd ..
fi

# Start the backend
echo "Launching FastAPI backend on port 8000..."
./backend/venv/bin/python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"
