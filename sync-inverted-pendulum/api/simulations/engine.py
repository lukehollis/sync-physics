"""Simulation engine for Orbit Engine solar system simulator."""
import asyncio
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np
from datetime import datetime, timedelta
import time
import json
import os

from .orbital_mechanics import (
    CelestialBody, SOLAR_SYSTEM_BODIES,
    kepler_to_cartesian, propagate_orbit,
    calculate_hohmann_transfer, calculate_porkchop_plot,
    generate_transfer_trajectory
)


@dataclass
class SimulationState:
    """Represents the current state of the solar system simulation."""
    timestamp: float  # Simulation time in seconds from epoch
    real_timestamp: datetime  # Real-world time
    bodies: Dict[str, Dict]  # Celestial body positions and states
    missions: List[Dict]  # Active missions
    time_scale: float  # Time acceleration factor
    is_playing: bool
    
    def to_dict(self):
        return {
            "timestamp": self.timestamp,
            "real_timestamp": self.real_timestamp.isoformat(),
            "bodies": self.bodies,
            "missions": self.missions,
            "time_scale": self.time_scale,
            "is_playing": self.is_playing
        }


class SimulationEngine:
    """Main simulation engine for solar system and trajectory calculations."""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.current_state = None
        self.is_running = False
        self.update_interval = 0.05  # 20 FPS update rate
        self.epoch = datetime(2024, 1, 1)  # Simulation epoch
        self.bodies = {}
        self.active_missions = []
        self.time_scale = 1.0  # Default 1x speed
        self.is_playing = False
        
        # Position logging
        self.position_log = []  # Buffer for position data
        self.timestep_counter = 0  # Counter for timesteps
        self.log_file_counter = 0  # Counter for log file numbering
        self.log_directory = "simulation_logs"  # Directory to save logs
        
        # Create log directory if it doesn't exist
        os.makedirs(self.log_directory, exist_ok=True)
        
    async def initialize(self):
        """Initialize the solar system simulation."""
        # Initialize celestial bodies
        self.bodies = dict(SOLAR_SYSTEM_BODIES)
        
        # Calculate initial positions
        initial_time = 0
        bodies_dict = {}
        
        for name, body in self.bodies.items():
            pos, vel = kepler_to_cartesian(body, initial_time)
            body.position = pos
            body.velocity = vel
            
            # Convert to frontend-friendly format (scale to AU for display)
            bodies_dict[name] = {
                "name": body.name,
                "position": (pos / 1.496e11).tolist(),  # Convert to AU
                "velocity": vel.tolist(),
                "radius": body.radius / 1.496e11,  # Convert to AU
                "mass": body.mass,
                "color": body.color,
                "type": "planet" if name != "sun" else "star"
            }
        
        self.current_state = SimulationState(
            timestamp=initial_time,
            real_timestamp=datetime.now(),
            bodies=bodies_dict,
            missions=self.active_missions,
            time_scale=self.time_scale,
            is_playing=self.is_playing
        )
        
    def save_position_log(self):
        """Save the position log to a file."""
        if not self.position_log:
            return
        
        # Generate filename with counter
        filename = f"{self.log_directory}/celestial_positions_{self.log_file_counter:04d}.json"
        
        # Save to JSON file
        with open(filename, 'w') as f:
            json.dump({
                "metadata": {
                    "total_timesteps": len(self.position_log),
                    "start_time": self.position_log[0]["timestamp"] if self.position_log else 0,
                    "end_time": self.position_log[-1]["timestamp"] if self.position_log else 0,
                    "epoch": self.epoch.isoformat(),
                    "file_number": self.log_file_counter
                },
                "data": self.position_log
            }, f, indent=2)
        
        print(f"Saved {len(self.position_log)} timesteps to {filename}")
        
        # Clear the log buffer and increment counter
        self.position_log = []
        self.log_file_counter += 1
    
    async def step(self, dt: float = None) -> SimulationState:
        """Execute one simulation step."""
        if not self.current_state:
            await self.initialize()
        
        # Use provided dt or calculate based on time scale
        if dt is None:
            dt = self.update_interval * self.time_scale
        
        if self.is_playing:
            # Update simulation time
            self.current_state.timestamp += dt
            
            # Log current positions before updating
            timestep_data = {
                "timestep": self.timestep_counter,
                "timestamp": self.current_state.timestamp,
                "real_time": datetime.now().isoformat(),
                "time_scale": self.time_scale,
                "bodies": {}
            }
            
            # Update celestial body positions
            for name, body in self.bodies.items():
                if name != 'sun':  # Sun stays at origin
                    # Use Kepler's equations for stable long-term orbits
                    pos, vel = kepler_to_cartesian(body, self.current_state.timestamp)
                    body.position = pos
                    body.velocity = vel
                    
                    # Update state dict (convert to AU for frontend)
                    self.current_state.bodies[name]["position"] = (pos / 1.496e11).tolist()
                    self.current_state.bodies[name]["velocity"] = vel.tolist()
                
                # Log position data for all bodies (including sun)
                timestep_data["bodies"][name] = {
                    "position_m": body.position.tolist(),  # Position in meters
                    "position_au": (body.position / 1.496e11).tolist(),  # Position in AU
                    "velocity_ms": body.velocity.tolist()  # Velocity in m/s
                }
            
            # Add timestep data to log
            self.position_log.append(timestep_data)
            self.timestep_counter += 1
            
            # Save to file every 10000 timesteps
            if self.timestep_counter % 10000 == 0 and self.timestep_counter > 0:
                self.save_position_log()
            
            # Update active missions
            for mission in self.active_missions:
                if mission["status"] == "active":
                    elapsed = self.current_state.timestamp - mission["launch_time"]
                    if elapsed >= 0 and elapsed <= mission["duration"]:
                        # Get position along trajectory
                        progress = elapsed / mission["duration"]
                        trajectory_index = int(progress * (len(mission["trajectory"]) - 1))
                        if trajectory_index < len(mission["trajectory"]):
                            point = mission["trajectory"][trajectory_index]
                            mission["current_position"] = point["position"]
                            mission["progress"] = progress
                    elif elapsed > mission["duration"]:
                        mission["status"] = "completed"
        
        # Update real timestamp
        self.current_state.real_timestamp = datetime.now()
        self.current_state.time_scale = self.time_scale
        self.current_state.is_playing = self.is_playing
        self.current_state.missions = self.active_missions
        
        return self.current_state
    
    async def run(self):
        """Run the simulation loop."""
        self.is_running = True
        while self.is_running:
            await self.step()
            await asyncio.sleep(self.update_interval)
    
    def play(self):
        """Start/resume simulation."""
        self.is_playing = True
    
    def pause(self):
        """Pause simulation."""
        self.is_playing = False
    
    def set_time_scale(self, scale: float):
        """Set simulation speed multiplier."""
        self.time_scale = max(0.1, min(scale, 1000000))  # Clamp between 0.1x and 1M x
    
    def stop(self):
        """Stop the simulation."""
        self.is_running = False
        self.is_playing = False
        
        # Save any remaining logged data
        if self.position_log:
            print(f"Saving final {len(self.position_log)} timesteps before stopping...")
            self.save_position_log()
    
    def get_state(self) -> Optional[SimulationState]:
        """Get current simulation state."""
        return self.current_state
    
    def focus_on_body(self, body_name: str) -> Optional[Dict]:
        """Get detailed information about a specific body."""
        if body_name.lower() in self.bodies:
            body = self.bodies[body_name.lower()]
            return {
                "name": body.name,
                "mass": body.mass,
                "radius": body.radius,
                "semi_major_axis": body.semi_major_axis,
                "eccentricity": body.eccentricity,
                "orbital_period": body.orbital_period / 86400,  # Convert to days
                "position": (body.position / 1.496e11).tolist(),
                "velocity": body.velocity.tolist()
            }
        return None
    
    def calculate_transfer(self, departure: str, arrival: str, 
                         departure_date: datetime, arrival_date: datetime) -> Dict:
        """Calculate a transfer trajectory between two bodies."""
        dep_body = self.bodies.get(departure.lower())
        arr_body = self.bodies.get(arrival.lower())
        
        if not dep_body or not arr_body:
            return {"error": "Invalid body names"}
        
        # Calculate time from epoch
        dep_time = (departure_date - self.epoch).total_seconds()
        arr_time = (arrival_date - self.epoch).total_seconds()
        
        # Calculate transfer
        transfer = calculate_hohmann_transfer(dep_body, arr_body)
        
        # Generate trajectory points
        trajectory = generate_transfer_trajectory(
            departure, arrival, dep_time, arr_time, num_points=200
        )
        
        return {
            "departure": departure,
            "arrival": arrival,
            "departure_date": departure_date.isoformat(),
            "arrival_date": arrival_date.isoformat(),
            "duration": arr_time - dep_time,
            "delta_v": transfer["delta_v_total"],
            "c3": transfer["c3"],
            "trajectory": trajectory
        }
    
    def launch_mission(self, transfer_data: Dict) -> Dict:
        """Launch a mission using calculated transfer data."""
        mission = {
            "id": f"mission_{len(self.active_missions) + 1}",
            "departure": transfer_data["departure"],
            "arrival": transfer_data["arrival"],
            "launch_time": (datetime.fromisoformat(transfer_data["departure_date"]) - self.epoch).total_seconds(),
            "arrival_time": (datetime.fromisoformat(transfer_data["arrival_date"]) - self.epoch).total_seconds(),
            "duration": transfer_data["duration"],
            "trajectory": transfer_data["trajectory"],
            "current_position": transfer_data["trajectory"][0]["position"],
            "progress": 0,
            "status": "active",
            "delta_v": transfer_data["delta_v"],
            "c3": transfer_data["c3"]
        }
        
        self.active_missions.append(mission)
        return mission
    
    def get_porkchop_data(self, departure: str, arrival: str,
                        dep_start: datetime, dep_end: datetime,
                        arr_start: datetime, arr_end: datetime) -> Dict:
        """Generate porkchop plot data for trajectory planning."""
        return calculate_porkchop_plot(
            departure, arrival,
            dep_start, dep_end,
            arr_start, arr_end,
            resolution=30
        )
