"""
CFD Simulation Module
Implements a simplified 2D fluid flow simulation using finite difference method
for demonstration purposes. Can be extended to use FEniCSx for more complex simulations.
"""

import numpy as np
import asyncio
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
import json
import time
from datetime import datetime


@dataclass
class SimulationConfig:
    """Configuration for CFD simulation"""
    name: str
    grid_size_x: int = 200
    grid_size_y: int = 80
    inlet_velocity: float = 1.0
    fluid_density: float = 1.0
    viscosity: float = 0.01
    time_steps: int = 1000
    dt: float = 0.001  # Reduced default time step for stability
    obstacle_type: str = "cylinder"  # cylinder, square, airfoil
    obstacle_position: Tuple[float, float] = (0.25, 0.5)  # relative position
    obstacle_size: float = 0.1  # relative size
    use_adaptive_dt: bool = True  # Enable adaptive time stepping
    cfl_number: float = 0.5  # CFL number for stability (< 1.0)


class CFDSimulation:
    """2D Computational Fluid Dynamics Simulation"""
    
    def __init__(self, config: SimulationConfig):
        self.config = config
        self.nx = config.grid_size_x
        self.ny = config.grid_size_y
        
        # Grid spacing
        self.dx = 1.0 / self.nx
        self.dy = 1.0 / self.ny
        
        # Initialize flow fields
        self.u = np.zeros((self.ny, self.nx))  # x-velocity
        self.v = np.zeros((self.ny, self.nx))  # y-velocity
        self.p = np.zeros((self.ny, self.nx))  # pressure
        self.vorticity = np.zeros((self.ny, self.nx))
        
        # Initialize with inlet velocity
        self.u[:, :] = config.inlet_velocity
        
        # Create obstacle mask
        self.obstacle_mask = self._create_obstacle()
        
        # Time tracking
        self.current_step = 0
        self.current_time = 0.0
        self.dt = config.dt  # Current time step
        
        # Results storage
        self.results_history = []
        
        # Stability tracking
        self.max_velocity = config.inlet_velocity
        self.divergence_history = []
        
    def _create_obstacle(self) -> np.ndarray:
        """Create obstacle geometry in the flow field"""
        mask = np.zeros((self.ny, self.nx), dtype=bool)
        
        cx = int(self.config.obstacle_position[0] * self.nx)
        cy = int(self.config.obstacle_position[1] * self.ny)
        radius = int(self.config.obstacle_size * min(self.nx, self.ny))
        
        y, x = np.ogrid[:self.ny, :self.nx]
        
        if self.config.obstacle_type == "cylinder":
            # Circular obstacle
            dist = np.sqrt((x - cx)**2 + (y - cy)**2)
            mask = dist <= radius
        elif self.config.obstacle_type == "square":
            # Square obstacle
            mask[cy-radius:cy+radius, cx-radius:cx+radius] = True
        elif self.config.obstacle_type == "airfoil":
            # Simplified airfoil shape (ellipse)
            a = radius * 2  # major axis
            b = radius * 0.3  # minor axis
            angle = np.pi / 6  # angle of attack
            
            # Rotated ellipse
            cos_a = np.cos(angle)
            sin_a = np.sin(angle)
            x_rot = (x - cx) * cos_a + (y - cy) * sin_a
            y_rot = -(x - cx) * sin_a + (y - cy) * cos_a
            
            mask = (x_rot / a)**2 + (y_rot / b)**2 <= 1
            
        return mask
    
    def _apply_boundary_conditions(self):
        """Apply boundary conditions"""
        # Inlet (left boundary)
        self.u[:, 0] = self.config.inlet_velocity
        self.v[:, 0] = 0
        
        # Outlet (right boundary) - zero gradient
        self.u[:, -1] = self.u[:, -2]
        self.v[:, -1] = self.v[:, -2]
        self.p[:, -1] = 0
        
        # Top and bottom walls - no slip
        self.u[0, :] = 0
        self.u[-1, :] = 0
        self.v[0, :] = 0
        self.v[-1, :] = 0
        
        # Obstacle - no slip condition
        self.u[self.obstacle_mask] = 0
        self.v[self.obstacle_mask] = 0
    
    def _compute_vorticity(self):
        """Compute vorticity field from velocity"""
        # Vorticity = dv/dx - du/dy
        dvdx = np.gradient(self.v, self.dx, axis=1)
        dudy = np.gradient(self.u, self.dy, axis=0)
        self.vorticity = dvdx - dudy
    
    def _calculate_cfl_timestep(self) -> float:
        """Calculate the maximum stable time step based on CFL condition"""
        # CFL condition: dt <= CFL * min(dx/|u|, dy/|v|)
        # Also consider viscous stability: dt <= 0.25 * min(dx^2, dy^2) / nu
        
        nu = self.config.viscosity / self.config.fluid_density
        
        # Convective CFL
        max_u = np.max(np.abs(self.u)) + 1e-10  # Add small value to prevent division by zero
        max_v = np.max(np.abs(self.v)) + 1e-10
        dt_conv = self.config.cfl_number * min(self.dx / max_u, self.dy / max_v)
        
        # Viscous CFL (diffusion stability)
        dt_visc = 0.25 * min(self.dx**2, self.dy**2) / (nu + 1e-10)
        
        # Take the minimum of both constraints
        dt_max = min(dt_conv, dt_visc)
        
        # Limit the time step change rate for smooth evolution
        if hasattr(self, 'dt'):
            dt_max = min(dt_max, 1.2 * self.dt)  # Don't increase too fast
            dt_max = max(dt_max, 0.5 * self.dt)   # Don't decrease too fast
        
        return min(dt_max, self.config.dt)  # Never exceed user-specified maximum
    
    def _solve_pressure_poisson(self, divergence: np.ndarray, iterations: int = 50) -> np.ndarray:
        """Solve pressure Poisson equation using iterative method"""
        # Solve: ∇²p = -ρ * divergence
        # Using Jacobi iteration for simplicity
        
        p = self.p.copy()
        p_new = np.zeros_like(p)
        
        for _ in range(iterations):
            p_new[1:-1, 1:-1] = 0.25 * (
                p[1:-1, 2:] + p[1:-1, :-2] +
                p[2:, 1:-1] + p[:-2, 1:-1] -
                self.dx * self.dy * self.config.fluid_density * divergence[1:-1, 1:-1]
            )
            
            # Apply boundary conditions for pressure
            p_new[:, 0] = p_new[:, 1]    # Left wall
            p_new[:, -1] = 0              # Outlet (zero pressure)
            p_new[0, :] = p_new[1, :]     # Top wall
            p_new[-1, :] = p_new[-2, :]   # Bottom wall
            
            # Set pressure inside obstacle to zero
            p_new[self.obstacle_mask] = 0
            
            p = p_new.copy()
        
        return p
    
    def _apply_stability_limits(self):
        """Apply stability limits to prevent numerical overflow"""
        # Limit maximum velocity to prevent runaway solutions
        max_allowed_velocity = 10.0 * self.config.inlet_velocity
        
        # Clip velocities
        self.u = np.clip(self.u, -max_allowed_velocity, max_allowed_velocity)
        self.v = np.clip(self.v, -max_allowed_velocity, max_allowed_velocity)
        
        # Remove NaN or Inf values
        self.u = np.nan_to_num(self.u, nan=0.0, posinf=max_allowed_velocity, neginf=-max_allowed_velocity)
        self.v = np.nan_to_num(self.v, nan=0.0, posinf=max_allowed_velocity, neginf=-max_allowed_velocity)
        self.p = np.nan_to_num(self.p, nan=0.0, posinf=1000.0, neginf=-1000.0)
    
    def step(self):
        """Perform one simulation time step using improved Navier-Stokes solver"""
        # Calculate adaptive time step if enabled
        if self.config.use_adaptive_dt:
            self.dt = self._calculate_cfl_timestep()
        else:
            self.dt = self.config.dt
        
        dt = self.dt
        nu = self.config.viscosity / self.config.fluid_density
        
        # Store previous values
        u_old = self.u.copy()
        v_old = self.v.copy()
        
        # Apply stability limits to old values to prevent propagation of bad values
        self._apply_stability_limits()
        
        # Step 1: Compute intermediate velocity (without pressure gradient)
        # Using a more stable discretization scheme
        
        # Compute gradients with safety checks
        dudx = np.gradient(self.u, self.dx, axis=1)
        dudy = np.gradient(self.u, self.dy, axis=0)
        dvdx = np.gradient(self.v, self.dx, axis=1)
        dvdy = np.gradient(self.v, self.dy, axis=0)
        
        # Compute Laplacian for viscous terms (more stable using finite differences)
        laplacian_u = np.zeros_like(self.u)
        laplacian_v = np.zeros_like(self.v)
        
        # Interior points - use central differences for Laplacian
        laplacian_u[1:-1, 1:-1] = (
            (self.u[1:-1, 2:] - 2*self.u[1:-1, 1:-1] + self.u[1:-1, :-2]) / self.dx**2 +
            (self.u[2:, 1:-1] - 2*self.u[1:-1, 1:-1] + self.u[:-2, 1:-1]) / self.dy**2
        )
        laplacian_v[1:-1, 1:-1] = (
            (self.v[1:-1, 2:] - 2*self.v[1:-1, 1:-1] + self.v[1:-1, :-2]) / self.dx**2 +
            (self.v[2:, 1:-1] - 2*self.v[1:-1, 1:-1] + self.v[:-2, 1:-1]) / self.dy**2
        )
        
        # Predict intermediate velocities (without pressure)
        u_star = u_old - dt * (u_old * dudx + v_old * dudy) + nu * dt * laplacian_u
        v_star = v_old - dt * (u_old * dvdx + v_old * dvdy) + nu * dt * laplacian_v
        
        # Apply boundary conditions to intermediate velocities
        u_star[self.obstacle_mask] = 0
        v_star[self.obstacle_mask] = 0
        u_star[:, 0] = self.config.inlet_velocity
        v_star[:, 0] = 0
        u_star[0, :] = 0
        u_star[-1, :] = 0
        v_star[0, :] = 0
        v_star[-1, :] = 0
        
        # Step 2: Solve pressure Poisson equation
        # Compute divergence of intermediate velocity
        dudx_star = np.gradient(u_star, self.dx, axis=1)
        dvdy_star = np.gradient(v_star, self.dy, axis=0)
        divergence = (dudx_star + dvdy_star) / dt
        
        # Solve for pressure
        self.p = self._solve_pressure_poisson(divergence, iterations=30)
        
        # Step 3: Correct velocities with pressure gradient
        dpdx = np.gradient(self.p, self.dx, axis=1)
        dpdy = np.gradient(self.p, self.dy, axis=0)
        
        self.u = u_star - dt * dpdx / self.config.fluid_density
        self.v = v_star - dt * dpdy / self.config.fluid_density
        
        # Apply final boundary conditions
        self._apply_boundary_conditions()
        
        # Apply stability limits to prevent overflow
        self._apply_stability_limits()
        
        # Compute vorticity
        self._compute_vorticity()
        
        # Track maximum velocity for monitoring
        self.max_velocity = np.max(np.sqrt(self.u**2 + self.v**2))
        
        # Update time
        self.current_step += 1
        self.current_time += dt
    
    def get_current_state(self) -> Dict[str, Any]:
        """Get current simulation state for visualization"""
        # Downsample for visualization if grid is too large
        step = max(1, self.nx // 100)
        
        # Get velocity magnitude with safety checks
        u_safe = np.nan_to_num(self.u, nan=0.0, posinf=10.0, neginf=-10.0)
        v_safe = np.nan_to_num(self.v, nan=0.0, posinf=10.0, neginf=-10.0)
        velocity_mag = np.sqrt(u_safe**2 + v_safe**2)
        
        # Create mesh grid for positions
        x = np.linspace(0, 1, self.nx)[::step]
        y = np.linspace(0, 1, self.ny)[::step]
        X, Y = np.meshgrid(x, y)
        
        # Downsample fields
        u_vis = self.u[::step, ::step]
        v_vis = self.v[::step, ::step]
        p_vis = self.p[::step, ::step]
        vort_vis = self.vorticity[::step, ::step]
        vel_mag_vis = velocity_mag[::step, ::step]
        obstacle_vis = self.obstacle_mask[::step, ::step]
        
        return {
            "timestamp": datetime.now().isoformat(),
            "step": self.current_step,
            "time": self.current_time,
            "grid": {
                "x": X.tolist(),
                "y": Y.tolist(),
                "nx": len(x),
                "ny": len(y)
            },
            "fields": {
                "u": u_vis.tolist(),
                "v": v_vis.tolist(),
                "pressure": p_vis.tolist(),
                "vorticity": vort_vis.tolist(),
                "velocity_magnitude": vel_mag_vis.tolist(),
                "obstacle": obstacle_vis.tolist()
            },
            "stats": {
                "max_velocity": float(np.nanmax(velocity_mag)) if not np.all(np.isnan(velocity_mag)) else 0.0,
                "min_pressure": float(np.nanmin(self.p)) if not np.all(np.isnan(self.p)) else 0.0,
                "max_pressure": float(np.nanmax(self.p)) if not np.all(np.isnan(self.p)) else 0.0,
                "max_vorticity": float(np.nanmax(np.abs(self.vorticity))) if not np.all(np.isnan(self.vorticity)) else 0.0,
                "time_step": self.dt,
                "divergence": float(np.mean(np.abs(np.gradient(self.u, self.dx, axis=1) + np.gradient(self.v, self.dy, axis=0))))
            }
        }
    
    def get_vector_field(self, max_vectors: int = 1000) -> Dict[str, Any]:
        """Get vector field data for visualization"""
        # Calculate appropriate step size for vector field
        total_points = self.nx * self.ny
        step = max(1, int(np.sqrt(total_points / max_vectors)))
        
        # Create positions and vectors
        positions = []
        vectors = []
        magnitudes = []
        
        for j in range(0, self.ny, step):
            for i in range(0, self.nx, step):
                if not self.obstacle_mask[j, i]:  # Skip points inside obstacle
                    x = i * self.dx
                    y = j * self.dy
                    u = self.u[j, i]
                    v = self.v[j, i]
                    mag = np.sqrt(u**2 + v**2)
                    
                    positions.append([x, y, 0])  # z=0 for 2D
                    vectors.append([u, v, 0])
                    magnitudes.append(mag)
        
        return {
            "positions": positions,
            "vectors": vectors,
            "magnitudes": magnitudes,
            "max_magnitude": float(np.max(magnitudes)) if magnitudes else 0
        }
    
    def get_streamlines(self, num_lines: int = 50) -> Dict[str, Any]:
        """Calculate streamlines for visualization"""
        streamlines = []
        
        # Starting points for streamlines (left edge)
        y_starts = np.linspace(0.1, 0.9, num_lines)
        
        for y_start in y_starts:
            line = []
            x, y = 0.05, y_start
            
            # Trace streamline
            for _ in range(200):  # Max points per streamline
                if x >= 1.0 or y <= 0 or y >= 1.0:
                    break
                    
                # Get grid indices
                i = int(x * self.nx)
                j = int(y * self.ny)
                
                if i >= self.nx or j >= self.ny:
                    break
                    
                if self.obstacle_mask[j, i]:
                    break
                
                # Get velocity at this point
                u = self.u[j, i]
                v = self.v[j, i]
                
                # Add point to streamline
                line.append([x, y, 0])
                
                # Move to next point
                speed = np.sqrt(u**2 + v**2)
                if speed < 0.001:
                    break
                    
                dt = 0.01 / speed
                x += u * dt
                y += v * dt
            
            if len(line) > 2:
                streamlines.append(line)
        
        return {
            "streamlines": streamlines,
            "count": len(streamlines)
        }
    
    async def run_async(self, callback=None):
        """Run simulation asynchronously with optional callback"""
        for step in range(self.config.time_steps):
            self.step()
            
            # Call callback every N steps for streaming updates
            if callback and step % 10 == 0:
                state = self.get_current_state()
                await callback(state)
            
            # Store snapshot for history
            if step % 50 == 0:
                self.results_history.append({
                    "step": step,
                    "time": self.current_time,
                    "state": self.get_current_state()
                })
            
            # Small delay to prevent blocking
            if step % 100 == 0:
                await asyncio.sleep(0.001)
        
        return self.results_history


class CFDSimulationManager:
    """Manager for multiple CFD simulations"""
    
    def __init__(self):
        self.simulations: Dict[str, CFDSimulation] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
    
    def create_simulation(self, config: SimulationConfig) -> str:
        """Create a new simulation"""
        sim_id = f"sim_{config.name}_{int(time.time())}"
        self.simulations[sim_id] = CFDSimulation(config)
        return sim_id
    
    def get_simulation(self, sim_id: str) -> Optional[CFDSimulation]:
        """Get simulation by ID"""
        return self.simulations.get(sim_id)
    
    def delete_simulation(self, sim_id: str):
        """Delete a simulation"""
        if sim_id in self.running_tasks:
            self.running_tasks[sim_id].cancel()
            del self.running_tasks[sim_id]
        
        if sim_id in self.simulations:
            del self.simulations[sim_id]
    
    async def start_simulation(self, sim_id: str, callback=None):
        """Start running a simulation"""
        sim = self.get_simulation(sim_id)
        if not sim:
            raise ValueError(f"Simulation {sim_id} not found")
        
        if sim_id in self.running_tasks:
            raise ValueError(f"Simulation {sim_id} is already running")
        
        task = asyncio.create_task(sim.run_async(callback))
        self.running_tasks[sim_id] = task
        
        return task
    
    def stop_simulation(self, sim_id: str):
        """Stop a running simulation"""
        if sim_id in self.running_tasks:
            self.running_tasks[sim_id].cancel()
            del self.running_tasks[sim_id]
    
    def is_running(self, sim_id: str) -> bool:
        """Check if simulation is running"""
        return sim_id in self.running_tasks and not self.running_tasks[sim_id].done()
    
    def list_simulations(self) -> List[Dict[str, Any]]:
        """List all simulations with their status"""
        return [
            {
                "id": sim_id,
                "name": sim.config.name,
                "status": "running" if self.is_running(sim_id) else "stopped",
                "current_step": sim.current_step,
                "total_steps": sim.config.time_steps
            }
            for sim_id, sim in self.simulations.items()
        ]


# Global simulation manager instance
simulation_manager = CFDSimulationManager()
