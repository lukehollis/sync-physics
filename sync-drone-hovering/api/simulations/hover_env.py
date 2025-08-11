"""Drone Hovering Environment using OpenAI Gym interface for Stable-Baselines3."""

import numpy as np
import gymnasium as gym
from gymnasium import spaces
from typing import Optional, Dict, Any, Tuple
import json


class HoverEnv(gym.Env):
    """
    Custom Environment for training a drone to hover at a target position.
    The drone has 4 rotors and needs to maintain stable hovering at a specific height.
    """
    
    metadata = {'render.modes': ['human']}
    
    def __init__(self, config: Optional[Dict] = None):
        super(HoverEnv, self).__init__()
        
        # Configuration
        self.config = config or {}
        self.dt = self.config.get('dt', 0.01)  # Time step
        self.max_steps = self.config.get('max_steps', 1000)
        self.target_height = self.config.get('target_height', 10.0)  # Target hovering height
        
        # Physical parameters
        self.mass = 1.0  # kg
        self.gravity = 9.81  # m/s^2
        self.max_thrust = 20.0  # N per rotor
        self.arm_length = 0.25  # Distance from center to rotor
        self.drag_coefficient = 0.1
        
        # State: [x, y, z, vx, vy, vz, roll, pitch, yaw, roll_rate, pitch_rate, yaw_rate]
        self.state_dim = 12
        
        # Action space: 4 rotor thrusts (normalized 0-1)
        self.action_space = spaces.Box(
            low=0.0, 
            high=1.0, 
            shape=(4,), 
            dtype=np.float32
        )
        
        # Observation space: drone state
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(self.state_dim,),
            dtype=np.float32
        )
        
        # Initialize state
        self.state = None
        self.steps = 0
        self.cumulative_reward = 0
        self.episode_count = 0
        
        # Reward weights for shaping
        self.position_weight = self.config.get('position_weight', 5.0)
        self.velocity_weight = self.config.get('velocity_weight', 1.0)
        self.orientation_weight = self.config.get('orientation_weight', 2.0)
        self.angular_velocity_weight = self.config.get('angular_velocity_weight', 0.5)
        
    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None) -> Tuple[np.ndarray, Dict]:
        """Reset the environment to initial state."""
        super().reset(seed=seed)
        
        # Random initial position near target
        self.state = np.zeros(self.state_dim)
        self.state[0] = np.random.uniform(-1, 1)  # x
        self.state[1] = np.random.uniform(-1, 1)  # y
        self.state[2] = np.random.uniform(8, 12)  # z (near target height)
        
        # Small random velocities
        self.state[3:6] = np.random.uniform(-0.5, 0.5, 3)
        
        # Small random orientation (in radians)
        self.state[6:9] = np.random.uniform(-0.1, 0.1, 3)
        
        # Zero angular velocities
        self.state[9:12] = 0.0
        
        self.steps = 0
        self.cumulative_reward = 0
        self.episode_count += 1
        
        return self.state.astype(np.float32), {}
    
    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        """Execute one time step within the environment."""
        if self.state is None:
            raise RuntimeError("Must reset environment before calling step()")
        
        # Clip actions to valid range
        action = np.clip(action, 0, 1)
        
        # Convert normalized actions to actual thrust forces
        thrusts = action * self.max_thrust
        
        # Calculate total thrust and torques
        total_thrust = np.sum(thrusts)
        
        # Torques from differential thrust
        # Rotors: 0-front, 1-right, 2-back, 3-left
        roll_torque = (thrusts[1] - thrusts[3]) * self.arm_length
        pitch_torque = (thrusts[0] - thrusts[2]) * self.arm_length
        yaw_torque = (thrusts[0] + thrusts[2] - thrusts[1] - thrusts[3]) * 0.1  # Simplified yaw
        
        # Current state unpacking
        pos = self.state[0:3]
        vel = self.state[3:6]
        orientation = self.state[6:9]  # roll, pitch, yaw
        angular_vel = self.state[9:12]
        
        # Calculate accelerations
        # Linear acceleration in body frame
        thrust_acc = total_thrust / self.mass
        
        # Convert to world frame (simplified for small angles)
        acc_world = np.array([
            thrust_acc * np.sin(orientation[1]),  # x acceleration from pitch
            -thrust_acc * np.sin(orientation[0]),  # y acceleration from roll
            thrust_acc * np.cos(orientation[0]) * np.cos(orientation[1]) - self.gravity
        ])
        
        # Add drag
        acc_world -= self.drag_coefficient * vel
        
        # Angular accelerations (simplified)
        inertia = 0.1  # Simplified moment of inertia
        angular_acc = np.array([
            roll_torque / inertia,
            pitch_torque / inertia,
            yaw_torque / inertia
        ])
        
        # Update state using Euler integration
        new_pos = pos + vel * self.dt
        new_vel = vel + acc_world * self.dt
        new_orientation = orientation + angular_vel * self.dt
        new_angular_vel = angular_vel + angular_acc * self.dt
        
        # Wrap angles to [-pi, pi]
        new_orientation = np.arctan2(np.sin(new_orientation), np.cos(new_orientation))
        
        # Update state
        self.state[0:3] = new_pos
        self.state[3:6] = new_vel
        self.state[6:9] = new_orientation
        self.state[9:12] = new_angular_vel
        
        # Calculate reward (dense reward function)
        target_pos = np.array([0, 0, self.target_height])
        position_error = np.linalg.norm(new_pos - target_pos)
        velocity_error = np.linalg.norm(new_vel)
        orientation_error = np.linalg.norm(new_orientation)
        angular_velocity_error = np.linalg.norm(new_angular_vel)
        
        # Shaped reward
        reward = -self.position_weight * position_error
        reward -= self.velocity_weight * velocity_error
        reward -= self.orientation_weight * orientation_error
        reward -= self.angular_velocity_weight * angular_velocity_error
        
        # Bonus for being close to target
        if position_error < 0.5:
            reward += 10.0
        
        # Penalty for excessive tilt
        max_tilt = np.max(np.abs(new_orientation[:2]))
        if max_tilt > np.pi/4:  # 45 degrees
            reward -= 10.0
        
        # Check termination conditions
        terminated = False
        
        # Crash conditions
        if new_pos[2] < 0.5:  # Too low
            terminated = True
            reward -= 100
        elif new_pos[2] > 20:  # Too high
            terminated = True
            reward -= 50
        elif np.any(np.abs(new_pos[:2]) > 10):  # Too far horizontally
            terminated = True
            reward -= 50
        elif max_tilt > np.pi/3:  # Excessive tilt (60 degrees)
            terminated = True
            reward -= 100
        
        self.steps += 1
        truncated = self.steps >= self.max_steps
        
        self.cumulative_reward += reward
        
        # Info for logging
        info = {
            'position': new_pos.tolist(),
            'velocity': new_vel.tolist(),
            'orientation': new_orientation.tolist(),
            'angular_velocity': new_angular_vel.tolist(),
            'position_error': float(position_error),
            'thrusts': thrusts.tolist(),
            'reward': float(reward),
            'cumulative_reward': float(self.cumulative_reward),
            'current_episode': self.episode_count,
            'timestep': self.steps
        }
        
        return self.state.astype(np.float32), float(reward), terminated, truncated, info
    
    def render(self, mode='human'):
        """Render the environment (not implemented for this basic version)."""
        pass
    
    def close(self):
        """Clean up resources."""
        pass
    
    def get_state_dict(self) -> Dict[str, Any]:
        """Get current state as a dictionary for visualization."""
        if self.state is None:
            return {}
        
        return {
            'position': self.state[0:3].tolist(),
            'velocity': self.state[3:6].tolist(),
            'orientation': self.state[6:9].tolist(),
            'angular_velocity': self.state[9:12].tolist(),
            'target_position': [0, 0, self.target_height],
            'episode': self.episode_count,
            'timestep': self.steps,
            'cumulative_reward': self.cumulative_reward
        }
