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
from simulations.drone_hovering import get_trainer
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global simulation instance
simulation_engine = None
simulation_task = None
drone_trainer = None

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

class DroneTrainingRequest(BaseModel):
    action: str  # "start", "stop", "reset"
    algorithm: Optional[str] = "PPO"
    timesteps: Optional[int] = 100000

class DroneModelRequest(BaseModel):
    action: str  # "save", "load"
    path: Optional[str] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global simulation_engine, simulation_task, drone_trainer
    
    # Startup
    logger.info("Starting Orbit Engine simulation...")
    simulation_engine = SimulationEngine()
    await simulation_engine.initialize()
    simulation_task = asyncio.create_task(simulation_engine.run())
    
    # Initialize drone trainer
    logger.info("Initializing Drone Hovering trainer...")
    drone_trainer = get_trainer()
    
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
    if drone_trainer:
        drone_trainer.stop_training()

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

# Drone Hovering Endpoints
@app.post("/api/drone/training")
async def control_drone_training(request: DroneTrainingRequest):
    """Control drone training (start, stop, reset)."""
    if not drone_trainer:
        raise HTTPException(status_code=503, detail="Drone trainer not initialized")
    
    try:
        if request.action == "start":
            asyncio.create_task(drone_trainer.start_training(
                total_timesteps=request.timesteps,
                algorithm=request.algorithm
            ))
            return {"status": "training_started", "algorithm": request.algorithm}
        elif request.action == "stop":
            drone_trainer.stop_training()
            return {"status": "training_stopped"}
        elif request.action == "reset":
            drone_trainer.reset_environment()
            return {"status": "environment_reset"}
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    except Exception as e:
        logger.error(f"Error in drone training control: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/drone/model")
async def manage_drone_model(request: DroneModelRequest):
    """Save or load drone model."""
    if not drone_trainer:
        raise HTTPException(status_code=503, detail="Drone trainer not initialized")
    
    try:
        if request.action == "save":
            path = drone_trainer.save_model(request.path)
            return {"status": "model_saved", "path": path}
        elif request.action == "load":
            if not request.path:
                raise HTTPException(status_code=400, detail="Path required for loading")
            success = drone_trainer.load_model(request.path)
            if success:
                return {"status": "model_loaded", "path": request.path}
            else:
                raise HTTPException(status_code=404, detail="Model file not found")
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    except Exception as e:
        logger.error(f"Error in model management: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/drone/status")
async def get_drone_status():
    """Get current drone training status."""
    if not drone_trainer:
        raise HTTPException(status_code=503, detail="Drone trainer not initialized")
    
    return drone_trainer.get_current_state()

@app.get("/api/drone/models")
async def list_saved_models():
    """List all saved drone models."""
    models_dir = Path("models")
    if not models_dir.exists():
        return {"models": []}
    
    models = []
    for model_file in models_dir.glob("*.zip"):
        models.append({
            "name": model_file.stem,
            "path": str(model_file),
            "size": model_file.stat().st_size,
            "modified": datetime.fromtimestamp(model_file.stat().st_mtime).isoformat()
        })
    
    return {"models": models}

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

@app.websocket("/ws/drone")
async def drone_websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for drone hovering simulation updates."""
    await websocket.accept()
    
    if not drone_trainer:
        await websocket.send_json({"type": "error", "message": "Drone trainer not initialized"})
        await websocket.close()
        return
    
    # Add connection to trainer
    drone_trainer.add_websocket(websocket)
    logger.info("Drone WebSocket client connected")
    
    try:
        # Send initial state
        state = drone_trainer.get_current_state()
        await websocket.send_json({
            "type": "initial_state",
            "data": state
        })
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for messages from client
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # 30 second timeout
                )
                
                # Parse and handle commands
                try:
                    cmd = json.loads(message)
                    
                    if cmd.get("type") == "training":
                        action = cmd.get("action")
                        if action == "start":
                            algorithm = cmd.get("algorithm", "PPO")
                            timesteps = cmd.get("timesteps", 100000)
                            asyncio.create_task(drone_trainer.start_training(timesteps, algorithm))
                            await websocket.send_json({"type": "status", "message": f"Training started with {algorithm}"})
                        elif action == "stop":
                            drone_trainer.stop_training()
                            await websocket.send_json({"type": "status", "message": "Training stopped"})
                        elif action == "reset":
                            drone_trainer.reset_environment()
                            await websocket.send_json({"type": "status", "message": "Environment reset"})
                    
                    elif cmd.get("type") == "model":
                        action = cmd.get("action")
                        if action == "save":
                            path = drone_trainer.save_model(cmd.get("name"))
                            await websocket.send_json({"type": "model_saved", "path": path})
                        elif action == "load":
                            success = drone_trainer.load_model(cmd.get("path"))
                            await websocket.send_json({"type": "model_loaded", "success": success})
                    
                    elif cmd.get("type") == "evaluate":
                        results = await drone_trainer.evaluate_model(cmd.get("episodes", 10))
                        await websocket.send_json({"type": "evaluation_results", "data": results})
                        
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON received from drone client")
                    
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})
                
    except WebSocketDisconnect:
        drone_trainer.remove_websocket(websocket)
        logger.info("Drone WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Error in drone websocket connection: {e}")
        drone_trainer.remove_websocket(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)