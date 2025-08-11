"""Main FastAPI application for Orbit Engine."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from simulations.engine import SimulationEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global simulation instance
simulation_engine = None
simulation_task = None

# Request/Response models
class TimeControlRequest(BaseModel):
    action: str  # "play", "pause", "set_speed"
    speed: Optional[float] = None

class BodyFocusRequest(BaseModel):
    body_name: str

class TransferCalculationRequest(BaseModel):
    departure: str
    arrival: str
    departure_date: str
    arrival_date: str

class PorkchopRequest(BaseModel):
    departure: str
    arrival: str
    departure_start: str
    departure_end: str
    arrival_start: str
    arrival_end: str

class LaunchMissionRequest(BaseModel):
    transfer_data: Dict

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global simulation_engine, simulation_task
    
    # Startup
    logger.info("Starting Orbit Engine simulation...")
    simulation_engine = SimulationEngine()
    await simulation_engine.initialize()
    simulation_task = asyncio.create_task(simulation_engine.run())
    
    yield
    
    # Shutdown
    logger.info("Shutting down Orbit Engine...")
    if simulation_engine:
        simulation_engine.stop()
    if simulation_task:
        simulation_task.cancel()
        try:
            await simulation_task
        except asyncio.CancelledError:
            pass

app = FastAPI(title="Orbit Engine API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active websocket connections
active_connections: List[WebSocket] = []

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Orbit Engine API", "status": "running"}

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "simulation_running": simulation_engine.is_running if simulation_engine else False
    }

@app.post("/api/control/time")
async def control_time(request: TimeControlRequest):
    """Control simulation time (play, pause, set speed)."""
    if not simulation_engine:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    if request.action == "play":
        simulation_engine.play()
        return {"status": "playing"}
    elif request.action == "pause":
        simulation_engine.pause()
        return {"status": "paused"}
    elif request.action == "set_speed" and request.speed is not None:
        simulation_engine.set_time_scale(request.speed)
        return {"status": "speed_set", "speed": request.speed}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@app.post("/api/focus")
async def focus_on_body(request: BodyFocusRequest):
    """Get detailed information about a celestial body."""
    if not simulation_engine:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    body_info = simulation_engine.focus_on_body(request.body_name)
    if body_info:
        return body_info
    else:
        raise HTTPException(status_code=404, detail=f"Body '{request.body_name}' not found")

@app.post("/api/trajectory/calculate")
async def calculate_trajectory(request: TransferCalculationRequest):
    """Calculate a transfer trajectory between two bodies."""
    if not simulation_engine:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    try:
        dep_date = datetime.fromisoformat(request.departure_date)
        arr_date = datetime.fromisoformat(request.arrival_date)
        
        result = simulation_engine.calculate_transfer(
            request.departure,
            request.arrival,
            dep_date,
            arr_date
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating trajectory: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/trajectory/porkchop")
async def generate_porkchop(request: PorkchopRequest):
    """Generate porkchop plot data for trajectory planning."""
    if not simulation_engine:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    try:
        dep_start = datetime.fromisoformat(request.departure_start)
        dep_end = datetime.fromisoformat(request.departure_end)
        arr_start = datetime.fromisoformat(request.arrival_start)
        arr_end = datetime.fromisoformat(request.arrival_end)
        
        result = simulation_engine.get_porkchop_data(
            request.departure,
            request.arrival,
            dep_start, dep_end,
            arr_start, arr_end
        )
        return result
    except Exception as e:
        logger.error(f"Error generating porkchop plot: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/mission/launch")
async def launch_mission(request: LaunchMissionRequest):
    """Launch a mission with calculated trajectory."""
    if not simulation_engine:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    try:
        mission = simulation_engine.launch_mission(request.transfer_data)
        return mission
    except Exception as e:
        logger.error(f"Error launching mission: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.websocket("/ws/engine")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time simulation updates."""
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"Client connected. Active connections: {len(active_connections)}")
    
    try:
        # Send connection confirmation message for debug console
        await websocket.send_json({
            "type": "status",
            "message": "WebSocket connected successfully"
        })
        
        # Send initial state
        if simulation_engine:
            state = simulation_engine.get_state()
            if state:
                await websocket.send_json({
                    "type": "state_update",
                    "data": state.to_dict()
                })
        
        # Handle incoming messages and send updates
        while True:
            try:
                # Non-blocking receive with timeout
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=0.05
                )
                
                # Parse and handle command
                try:
                    cmd = json.loads(message)
                    if cmd.get("type") == "control":
                        if cmd.get("action") == "play":
                            simulation_engine.play()
                            await websocket.send_json({"type": "status", "message": "Playing"})
                        elif cmd.get("action") == "pause":
                            simulation_engine.pause()
                            await websocket.send_json({"type": "status", "message": "Paused"})
                        elif cmd.get("action") == "set_speed":
                            speed = cmd.get("speed", 1.0)
                            simulation_engine.set_time_scale(speed)
                            await websocket.send_json({"type": "status", "message": f"Speed set to {speed}x"})
                    elif cmd.get("type") == "focus":
                        body_name = cmd.get("body_name")
                        if body_name:
                            info = simulation_engine.focus_on_body(body_name)
                            if info:
                                await websocket.send_json({"type": "body_info", "data": info})
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON received from client")
                    
            except asyncio.TimeoutError:
                # No message received, send state update
                if simulation_engine:
                    state = simulation_engine.get_state()
                    if state:
                        await websocket.send_json({
                            "type": "state_update",
                            "data": state.to_dict()
                        })
            
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info(f"Client disconnected. Active connections: {len(active_connections)}")
    except Exception as e:
        logger.error(f"Error in websocket connection: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)