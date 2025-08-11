#!/bin/bash

# Start the Inverted Pendulum Simulation

echo "Starting Inverted Pendulum Simulation..."

# Function to kill background processes on exit
cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Start backend API
echo "Starting backend API on port 8002..."
cd api
python main.py &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "Starting frontend on port 5173..."
cd client
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "==================================="
echo "Inverted Pendulum Simulation Ready!"
echo "==================================="
echo ""
echo "Backend API: http://localhost:8002"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Wait for background processes
wait
