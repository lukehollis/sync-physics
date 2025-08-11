# Orbit Engine - Solar System Simulator

A real-time solar system simulator with interplanetary trajectory planning capabilities.

## Features

- **3D Solar System Visualization**: Real-time rendering of planets orbiting the Sun using Three.js
- **Time Controls**: Play, pause, and adjust simulation speed (1x to 1,000,000x)
- **Trajectory Planning**: Calculate optimal transfer orbits between planets
- **Porkchop Plots**: Visualize launch windows and energy requirements
- **Mission Simulation**: Launch and track spacecraft along calculated trajectories
- **Interactive Controls**: Click on planets to view detailed information

## Architecture

### Backend (Python FastAPI)
- **Orbital Mechanics Engine**: Calculates planetary positions using Kepler's equations
- **Trajectory Calculator**: Computes Hohmann transfer orbits and porkchop plots
- **WebSocket Server**: Streams real-time simulation updates to frontend
- **REST API**: Handles trajectory calculations and mission launches

### Frontend (React + Three.js)
- **3D Visualization**: Solar system rendered with Three.js/React Three Fiber
- **Control Panels**: Time controls, body information, mission status
- **Trajectory Planner**: Interactive interface for mission planning
- **WebSocket Client**: Receives real-time simulation updates

## Installation

### Backend Setup
```bash
cd api
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv sync 
```

### Frontend Setup
```bash
cd client
pnpm install
```

## Running the Application

### Start the Backend Server
```bash
cd api
uvicorn main:app --reload --port 8000
```

### Start the Frontend Development Server
```bash
cd client
pnpm run dev
```

Open your browser and navigate to `http://localhost:5173`

## Usage

### Main View Controls
- **Mouse**: Click and drag to rotate the view
- **Scroll**: Zoom in/out
- **Click Planet**: Select and focus on a celestial body
- **Play/Pause**: Control simulation time
- **Speed**: Adjust time acceleration (1x to 1M x)

### Mission Planning
1. Click "Plan Mission" button
2. Select departure and arrival planets
3. Set departure and arrival date ranges
4. Click "Calculate Transfer Windows"
5. View the porkchop plot showing energy requirements
6. Click on a point in the plot to see transfer details
7. Click "Launch Mission" to start the spacecraft

### Trajectory Visualization
- Green line: Planned trajectory path
- Green cone: Spacecraft position
- Progress bar: Mission completion status

## Concept Design

The application is built using concept design principles with the following core concepts:

- **CelestialBody**: Manages planetary states and positions
- **Simulation**: Controls time flow and simulation state
- **Trajectory**: Calculates interplanetary transfers
- **Mission**: Manages spacecraft missions
- **Camera**: Controls 3D view perspective

## Technical Details

### Orbital Mechanics
- Uses simplified Kepler's equations for planetary motion
- Hohmann transfer approximation for trajectory planning
- Porkchop plots for launch window analysis

### Performance Optimizations
- Pre-calculated planetary ephemerides
- Efficient WebSocket streaming (20 FPS)
- Three.js instancing for multiple objects
- React state management with hooks

## API Endpoints

- `POST /api/control/time` - Control simulation (play/pause/speed)
- `POST /api/focus` - Get celestial body information
- `POST /api/trajectory/calculate` - Calculate transfer trajectory
- `POST /api/trajectory/porkchop` - Generate porkchop plot data
- `POST /api/mission/launch` - Launch a mission
- `WS /ws/engine` - WebSocket for real-time updates

## Future Enhancements

- N-body physics simulation for more accurate trajectories
- Additional celestial bodies (moons, asteroids)
- Gravity assists and complex trajectories
- Mission timeline and event management
- Save/load simulation states
- Multi-spacecraft support
