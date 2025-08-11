"""Drone Hovering Training System with Stable-Baselines3 and WebSocket support."""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import numpy as np
import os
from pathlib import Path

from stable_baselines3 import PPO, A2C, SAC
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.vec_env import DummyVecEnv
import torch

from stable_baselines3.common.monitor import Monitor

from .hover_env import HoverEnv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WebSocketCallback(BaseCallback):
    """Custom callback for sending training updates via WebSocket."""
    
    def __init__(self, websocket_handler=None, loop=None, verbose=0):
        super(WebSocketCallback, self).__init__(verbose)
        self.websocket_handler = websocket_handler
        self.loop = loop
        self.episode_rewards = []
        self.episode_lengths = []
        self.current_episode_reward = 0
        self.current_episode_length = 0
        
    def _on_step(self) -> bool:
        """Called after each step in the environment."""
        try:
            # Get info from the environment - check if infos exists and is iterable
            infos = self.locals.get('infos')
            
            # Make sure infos is a list/iterable and not None or a single value
            if infos is not None and hasattr(infos, '__iter__') and not isinstance(infos, (str, bytes)):
                for info in infos:
                    # Make sure info is a dictionary
                    if not isinstance(info, dict):
                        continue
                        
                    if self.websocket_handler and self.loop:
                        # Send state update using the main thread's event loop
                        asyncio.run_coroutine_threadsafe(
                            self.websocket_handler.send_state_update(info),
                            self.loop
                        )
                    
                    # Check if episode finished (Stable-Baselines3 puts episode stats in info when done)
                    if 'episode' in info:
                        episode_info = info['episode']
                        # Episode info should be a dict with 'r' (reward) and 'l' (length) keys
                        if isinstance(episode_info, dict) and 'r' in episode_info and 'l' in episode_info:
                            self.episode_rewards.append(episode_info['r'])
                            self.episode_lengths.append(episode_info['l'])
                            
                            # Send episode completion update
                            if self.websocket_handler and self.loop:
                                asyncio.run_coroutine_threadsafe(
                                    self.websocket_handler.send_episode_update({
                                        'episode': len(self.episode_rewards),
                                        'reward': episode_info['r'],
                                        'length': episode_info['l'],
                                        'mean_reward': np.mean(self.episode_rewards[-100:]) if self.episode_rewards else 0
                                    }),
                                    self.loop
                                )
        except Exception as e:
            # Log the error but don't stop training
            logger.debug(f"WebSocketCallback error (non-critical): {e}")
        
        return True


class DroneHoveringTrainer:
    """Main trainer class for drone hovering using Stable-Baselines3."""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.env = None
        self.model = None
        self.is_training = False
        self.current_algorithm = 'PPO'
        self.websocket_connections = []
        self.training_task = None
        self.models_dir = Path("models")
        self.models_dir.mkdir(exist_ok=True)
        
        # Training statistics
        self.training_stats = {
            'episodes': [],
            'rewards': [],
            'mean_rewards': [],
            'timestamps': []
        }
        
        # Initialize environment
        self.reset_environment()
        
    def reset_environment(self):
        """Reset the training environment."""
        if self.env:
            self.env.close()
        
        # Create environment
        env_config = self.config.get('env_config', {})
        self.env = HoverEnv(env_config)
        self.env = Monitor(self.env)
        
        # Wrap in vectorized environment for SB3
        self.vec_env = DummyVecEnv([lambda: self.env])
        
        logger.info("Environment reset successfully")
        
    def create_model(self, algorithm: str = 'PPO', load_path: Optional[str] = None):
        """Create or load a model for training."""
        
        # Model hyperparameters
        policy_kwargs = dict(
            net_arch=[256, 256],  # Two hidden layers with 256 neurons each
            activation_fn=torch.nn.ReLU
        )
        
        if algorithm == 'PPO':
            self.model = PPO(
                "MlpPolicy",
                self.vec_env,
                learning_rate=3e-4,
                n_steps=2048,
                batch_size=64,
                n_epochs=10,
                gamma=0.99,
                gae_lambda=0.95,
                clip_range=0.2,
                clip_range_vf=None,
                ent_coef=0.01,
                vf_coef=0.5,
                max_grad_norm=0.5,
                policy_kwargs=policy_kwargs,
                verbose=1,
                tensorboard_log="./tensorboard_logs/"
            )
        elif algorithm == 'A2C':
            self.model = A2C(
                "MlpPolicy",
                self.vec_env,
                learning_rate=7e-4,
                n_steps=5,
                gamma=0.99,
                gae_lambda=1.0,
                ent_coef=0.01,
                vf_coef=0.5,
                max_grad_norm=0.5,
                policy_kwargs=policy_kwargs,
                verbose=1,
                tensorboard_log="./tensorboard_logs/"
            )
        elif algorithm == 'SAC':
            self.model = SAC(
                "MlpPolicy",
                self.vec_env,
                learning_rate=3e-4,
                buffer_size=1000000,
                learning_starts=100,
                batch_size=256,
                tau=0.005,
                gamma=0.99,
                train_freq=1,
                gradient_steps=1,
                policy_kwargs=policy_kwargs,
                verbose=1,
                tensorboard_log="./tensorboard_logs/"
            )
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")
        
        self.current_algorithm = algorithm
        
        # Load existing model if specified
        if load_path and os.path.exists(load_path):
            self.model = self.model.load(load_path, env=self.vec_env)
            logger.info(f"Loaded model from {load_path}")
        
        logger.info(f"Created {algorithm} model")
        
    async def start_training(self, total_timesteps: int = 100000, algorithm: str = 'PPO'):
        """Start the training loop."""
        if self.is_training:
            logger.warning("Training is already in progress")
            return
        
        self.is_training = True
        self.create_model(algorithm)
        
        # Get the current event loop to pass to the callback
        loop = asyncio.get_event_loop()
        
        # Create callback for WebSocket updates with the event loop
        callback = WebSocketCallback(websocket_handler=self, loop=loop)
        
        try:
            logger.info(f"Starting training with {algorithm} for {total_timesteps} timesteps")
            
            # Run training in a separate thread to not block async
            # Note: model.learn expects callback as a keyword argument
            await loop.run_in_executor(
                None,
                lambda: self.model.learn(
                    total_timesteps=total_timesteps,
                    callback=callback
                )
            )
            
            logger.info("Training completed successfully")
            
        except Exception as e:
            import traceback
            logger.error(f"Training error: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
        finally:
            self.is_training = False
            
    def stop_training(self):
        """Stop the training loop."""
        self.is_training = False
        logger.info("Training stopped")
        
    def save_model(self, name: Optional[str] = None):
        """Save the current model."""
        if not self.model:
            logger.error("No model to save")
            return None
        
        if not name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name = f"drone_hover_{self.current_algorithm}_{timestamp}"
        
        save_path = self.models_dir / f"{name}.zip"
        self.model.save(save_path)
        logger.info(f"Model saved to {save_path}")
        return str(save_path)
        
    def load_model(self, path: str):
        """Load a saved model."""
        if not os.path.exists(path):
            logger.error(f"Model file not found: {path}")
            return False
        
        # Detect algorithm from filename if possible
        algorithm = 'PPO'  # Default
        if 'A2C' in path.upper():
            algorithm = 'A2C'
        elif 'SAC' in path.upper():
            algorithm = 'SAC'
        
        self.create_model(algorithm, load_path=path)
        logger.info(f"Model loaded from {path}")
        return True
        
    async def evaluate_model(self, num_episodes: int = 10):
        """Evaluate the current model."""
        if not self.model:
            logger.error("No model to evaluate")
            return None
        
        rewards = []
        lengths = []
        
        for episode in range(num_episodes):
            # Reset returns (observation, info) tuple
            obs, _ = self.env.reset()
            done = False
            episode_reward = 0
            episode_length = 0
            
            while not done:
                # Predict action using the model
                action, _ = self.model.predict(obs, deterministic=True)
                # Action might be wrapped in an extra dimension for vectorized envs
                if action.ndim > 1:
                    action = action[0]
                    
                obs, reward, terminated, truncated, info = self.env.step(action)
                done = terminated or truncated
                episode_reward += reward
                episode_length += 1
                
                # Send update via WebSocket
                await self.send_state_update(info)
            
            rewards.append(episode_reward)
            lengths.append(episode_length)
            
        eval_results = {
            'mean_reward': np.mean(rewards),
            'std_reward': np.std(rewards),
            'mean_length': np.mean(lengths),
            'num_episodes': num_episodes
        }
        
        logger.info(f"Evaluation results: {eval_results}")
        return eval_results
        
    def get_current_state(self) -> Dict[str, Any]:
        """Get the current state of the drone and training."""
        state = {
            'is_training': self.is_training,
            'algorithm': self.current_algorithm,
            'episode': self.env.env.episode_count if self.env and hasattr(self.env, 'env') else 0,
            'training_stats': self.training_stats
        }
        
        if self.env:
            state.update(self.env.env.get_state_dict())
        
        return state
    
    async def send_state_update(self, info: Dict[str, Any]):
        """Send state update to all connected WebSocket clients."""
        message = {
            'type': 'state_update',
            'data': {
                'position': info.get('position', [0, 0, 0]),
                'orientation': info.get('orientation', [0, 0, 0]),
                'velocity': info.get('velocity', [0, 0, 0]),
                'angular_velocity': info.get('angular_velocity', [0, 0, 0]),
                'thrusts': info.get('thrusts', [0, 0, 0, 0]),
                'reward': info.get('reward', 0),
                'cumulative_reward': info.get('cumulative_reward', 0),
                'episode': info.get('current_episode', 0),
                'timestep': info.get('timestep', 0),
                'position_error': info.get('position_error', 0)
            }
        }
        
        # Send to all connected clients
        for ws in self.websocket_connections:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send WebSocket message: {e}")
                
    async def send_episode_update(self, episode_data: Dict[str, Any]):
        """Send episode completion update to WebSocket clients."""
        message = {
            'type': 'episode_complete',
            'data': episode_data
        }
        
        # Update training stats
        self.training_stats['episodes'].append(episode_data['episode'])
        self.training_stats['rewards'].append(episode_data['reward'])
        self.training_stats['mean_rewards'].append(episode_data['mean_reward'])
        self.training_stats['timestamps'].append(datetime.now().isoformat())
        
        # Keep only last 1000 episodes in memory
        if len(self.training_stats['episodes']) > 1000:
            for key in self.training_stats:
                self.training_stats[key] = self.training_stats[key][-1000:]
        
        for ws in self.websocket_connections:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send episode update: {e}")
                
    def add_websocket(self, ws):
        """Add a WebSocket connection to the list."""
        if ws not in self.websocket_connections:
            self.websocket_connections.append(ws)
            logger.info(f"WebSocket added. Total connections: {len(self.websocket_connections)}")
            
    def remove_websocket(self, ws):
        """Remove a WebSocket connection from the list."""
        if ws in self.websocket_connections:
            self.websocket_connections.remove(ws)
            logger.info(f"WebSocket removed. Total connections: {len(self.websocket_connections)}")


# Global trainer instance
trainer = None

def get_trainer() -> DroneHoveringTrainer:
    """Get or create the global trainer instance."""
    global trainer
    if trainer is None:
        trainer = DroneHoveringTrainer()
    return trainer
