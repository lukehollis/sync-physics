#!/bin/bash

# Start the CFD simulation application

echo "Starting CFD Simulation Application..."
echo "=================================="

# Start the backend API server
echo "Starting Backend API server..."
cd api
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start the frontend development server
echo "Starting Frontend development server..."
cd client
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=================================="
echo "CFD Simulation Application is running!"
echo ""
echo "Backend API: http://localhost:8003"
echo "Frontend App: http://localhost:5173"
echo ""
echo "To access the CFD simulation:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Click on 'CFD Simulation' in the navigation bar"
echo "3. Create a new simulation and start it"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=================================="

# Wait for user to press Ctrl+C
trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
