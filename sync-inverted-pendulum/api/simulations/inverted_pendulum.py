"""Inverted pendulum physics simulation using Lagrangian mechanics."""
import numpy as np
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class PendulumState:
    """State of the inverted pendulum system."""
    x: float  # Cart position (m)
    x_dot: float  # Cart velocity (m/s)
    theta: float  # Pendulum angle from vertical (rad)
    theta_dot: float  # Pendulum angular velocity (rad/s)
    time: float  # Simulation time (s)
    applied_force: float  # Currently applied force (N)
    
    def to_dict(self) -> Dict:
        """Convert state to dictionary for JSON serialization."""
        return {
            'x': self.x,
            'x_dot': self.x_dot,
            'theta': self.theta,
            'theta_dot': self.theta_dot,
            'theta_degrees': np.degrees(self.theta),
            'time': self.time,
            'applied_force': self.applied_force
        }

@dataclass
class PendulumParameters:
    """Physical parameters of the inverted pendulum system."""
    M: float = 1.0  # Cart mass (kg)
    m: float = 0.2  # Pendulum mass (kg)
    l: float = 0.5  # Pendulum length (m)
    g: float = 9.81  # Gravity (m/s²)
    friction: float = 0.1  # Cart friction coefficient
    
    def to_dict(self) -> Dict:
        """Convert parameters to dictionary."""
        return {
            'cart_mass': self.M,
            'pendulum_mass': self.m,
            'pendulum_length': self.l,
            'gravity': self.g,
            'friction': self.friction
        }

class InvertedPendulumSimulation:
    """Inverted pendulum physics simulation engine."""
    
    def __init__(self, dt: float = 0.01):
        """Initialize the simulation.
        
        Args:
            dt: Time step for numerical integration (seconds)
        """
        self.dt = dt
        self.params = PendulumParameters()
        self.state = PendulumState(
            x=0.0,
            x_dot=0.0,
            theta=0.01,  # Small initial angle
            theta_dot=0.0,
            time=0.0,
            applied_force=0.0
        )
        self.is_running = False
        self.time_scale = 1.0
        self.balance_mode = False
        self.balance_start_time = None
        self.balance_end_time = None
        
        # Track limits
        self.track_length = 5.0  # Total track length (m)
        self.angle_limit = np.pi / 2  # Maximum angle before considering fallen
        
    def reset(self, initial_angle: float = 0.01):
        """Reset the simulation to initial conditions.
        
        Args:
            initial_angle: Initial pendulum angle from vertical (radians)
        """
        self.state = PendulumState(
            x=0.0,
            x_dot=0.0,
            theta=initial_angle,
            theta_dot=0.0,
            time=0.0,
            applied_force=0.0
        )
        self.balance_mode = False
        self.balance_start_time = None
        self.balance_end_time = None
        logger.info("Simulation reset")
        
    def apply_force(self, force: float):
        """Apply a horizontal force to the cart.
        
        Args:
            force: Force in Newtons (positive = right, negative = left)
        """
        # Clamp force to reasonable limits
        max_force = 50.0
        self.state.applied_force = np.clip(force, -max_force, max_force)
        
    def derivatives(self, state: Tuple[float, float, float, float], F_c: float) -> Tuple[float, float, float, float]:
        """Calculate derivatives using Lagrangian mechanics.
        
        The equations of motion for the inverted pendulum are:
        (M + m)ẍ + mlθ̈cos(θ) - mlθ̇²sin(θ) = F_c - friction*ẋ
        lθ̈ + ẍcos(θ) - gsin(θ) = 0
        
        Args:
            state: Current state (x, x_dot, theta, theta_dot)
            F_c: Applied force
            
        Returns:
            Derivatives (x_dot, x_ddot, theta_dot, theta_ddot)
        """
        x, x_dot, theta, theta_dot = state
        
        M = self.params.M
        m = self.params.m
        l = self.params.l
        g = self.params.g
        friction = self.params.friction
        
        sin_theta = np.sin(theta)
        cos_theta = np.cos(theta)
        
        # Calculate the denominators for the coupled equations
        denominator = M + m - m * cos_theta * cos_theta
        
        if abs(denominator) < 1e-10:
            # Avoid division by zero
            denominator = 1e-10
            
        # Calculate accelerations using the derived equations
        theta_ddot = (g * sin_theta - cos_theta * (F_c - friction * x_dot - m * l * theta_dot**2 * sin_theta) / (M + m)) / l
        theta_ddot = theta_ddot / (1 - m * cos_theta**2 / (M + m))
        
        x_ddot = (F_c - friction * x_dot - m * l * (theta_ddot * cos_theta - theta_dot**2 * sin_theta)) / (M + m)
        
        return (x_dot, x_ddot, theta_dot, theta_ddot)
    
    def runge_kutta_4(self, state: Tuple[float, float, float, float], F_c: float, dt: float) -> Tuple[float, float, float, float]:
        """Fourth-order Runge-Kutta integration.
        
        Args:
            state: Current state
            F_c: Applied force
            dt: Time step
            
        Returns:
            New state after integration
        """
        k1 = self.derivatives(state, F_c)
        
        state_k2 = tuple(s + 0.5 * dt * k for s, k in zip(state, k1))
        k2 = self.derivatives(state_k2, F_c)
        
        state_k3 = tuple(s + 0.5 * dt * k for s, k in zip(state, k2))
        k3 = self.derivatives(state_k3, F_c)
        
        state_k4 = tuple(s + dt * k for s, k in zip(state, k3))
        k4 = self.derivatives(state_k4, F_c)
        
        # Combine the k values
        new_state = tuple(
            s + dt / 6.0 * (k1_i + 2*k2_i + 2*k3_i + k4_i)
            for s, k1_i, k2_i, k3_i, k4_i in zip(state, k1, k2, k3, k4)
        )
        
        return new_state
    
    def step(self):
        """Perform one simulation step."""
        if not self.is_running:
            return
            
        # Get current state as tuple
        current_state = (self.state.x, self.state.x_dot, self.state.theta, self.state.theta_dot)
        
        # Integrate using RK4
        effective_dt = self.dt * self.time_scale
        new_state = self.runge_kutta_4(current_state, self.state.applied_force, effective_dt)
        
        # Update state
        self.state.x, self.state.x_dot, self.state.theta, self.state.theta_dot = new_state
        
        # Apply track limits
        half_track = self.track_length / 2
        if abs(self.state.x) > half_track:
            self.state.x = np.sign(self.state.x) * half_track
            self.state.x_dot = 0  # Stop at the edge
            
        # Normalize angle to [-pi, pi]
        while self.state.theta > np.pi:
            self.state.theta -= 2 * np.pi
        while self.state.theta < -np.pi:
            self.state.theta += 2 * np.pi
            
        # Update time
        self.state.time += effective_dt
        
        # Check balance mode
        if self.balance_mode:
            if abs(self.state.theta) > np.radians(12):  # 12 degrees threshold
                self.balance_end_time = self.state.time
                self.balance_mode = False
                logger.info(f"Balance challenge ended. Duration: {self.balance_end_time - self.balance_start_time:.2f}s")
    
    def start_balance_challenge(self):
        """Start the balance challenge mode."""
        self.reset(initial_angle=np.radians(1))  # Start with 1 degree offset
        self.balance_mode = True
        self.balance_start_time = self.state.time
        self.balance_end_time = None
        logger.info("Balance challenge started")
        
    def get_balance_time(self) -> Optional[float]:
        """Get the current balance time if in balance mode."""
        if self.balance_mode and self.balance_start_time is not None:
            return self.state.time - self.balance_start_time
        elif self.balance_end_time is not None and self.balance_start_time is not None:
            return self.balance_end_time - self.balance_start_time
        return None
    
    def play(self):
        """Start the simulation."""
        self.is_running = True
        
    def pause(self):
        """Pause the simulation."""
        self.is_running = False
        
    def set_time_scale(self, scale: float):
        """Set the simulation time scale.
        
        Args:
            scale: Time scale factor (1.0 = real-time, 2.0 = double speed)
        """
        self.time_scale = max(0.1, min(10.0, scale))
        
    def set_parameters(self, **kwargs):
        """Update physical parameters.
        
        Args:
            **kwargs: Parameter name-value pairs
        """
        for key, value in kwargs.items():
            if hasattr(self.params, key):
                setattr(self.params, key, value)
                logger.info(f"Updated parameter {key} = {value}")
                
    def get_state(self) -> PendulumState:
        """Get the current state of the simulation."""
        return self.state
    
    def get_full_state(self) -> Dict:
        """Get complete state including parameters and balance info."""
        state_dict = self.state.to_dict()
        state_dict['parameters'] = self.params.to_dict()
        state_dict['is_running'] = self.is_running
        state_dict['time_scale'] = self.time_scale
        state_dict['track_length'] = self.track_length
        
        if self.balance_mode or self.balance_end_time is not None:
            state_dict['balance_time'] = self.get_balance_time()
            state_dict['balance_active'] = self.balance_mode
            
        return state_dict
    
    async def run(self):
        """Main simulation loop for async operation."""
        logger.info("Starting inverted pendulum simulation loop")
        while True:
            try:
                if self.is_running:
                    self.step()
                await asyncio.sleep(self.dt)
            except asyncio.CancelledError:
                logger.info("Simulation loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}")
                await asyncio.sleep(0.1)
