import numpy as np
import torch
from gymnasium.spaces import Box, Dict as SpaceDict, Discrete
from typing import Dict, List, Tuple, Any, Optional, Union, Set
import logging
from dataclasses import dataclass
import math
import osmnx as ox
import geopandas as gpd
from shapely.geometry import Point, Polygon, LineString
import networkx as nx
import redis
import pickle
import hashlib
import json # For stable hashing of the bounds dict
import requests # Add requests for OpenTopoData API calls
import sys
import os

logger = logging.getLogger(__name__)

# Constants for the urban environment
MAX_AGENTS = 100000  # Maximum number of agents the environment supports
MAX_SPEED = 0.0005  # Maximum movement speed per step

@dataclass
class AgentState:
    """Represents the state of a single agent in the urban environment"""
    agent_id: str
    position: np.ndarray  # [lat, lng]
    velocity: np.ndarray  # [dlat, dlng]
    goal: np.ndarray      # Destination [lat, lng]
    
    # --- Add path attributes --- 
    path: Optional[List[int]] = None # List of OSMnx node IDs for the path
    path_index: int = 0             # Current index in the path list
    
    def to_tensor(self) -> torch.Tensor:
        """Convert agent state to tensor representation"""
        # Basic state: position (2) + velocity (2) + goal (2)
        state = np.concatenate([
            self.position,
            self.velocity,
            self.goal
        ])
        
        return torch.tensor(state, dtype=torch.float32)


class DriveGraphEnv:
    """
    DriveGraph environment that simulates thousands of agents 
    (vehicles) moving in a city.
    
    Uses spatial partitioning and supports both individual and aggregate agent modeling.
    """
    
    def __init__(self, 
                 bounds: Dict[str, float], 
                 redis_client: Optional[redis.Redis] = None, # Pass in redis client
                 force_osm_refresh: bool = False, # Option to bypass cache
                 max_agents: int = MAX_AGENTS,
                 max_steps: int = 1000,
                 continuous_simulation: bool = False, # Added continuous flag
                 snap_resolution: float = 0.02): # Added snap_resolution for caching
        """Initialize the urban mobility environment.
        
        Args:
            bounds: Dictionary with minLat, maxLat, minLng, maxLng (precise viewport)
            redis_client: Redis client for caching (passed from api.py's global client)
            force_osm_refresh: Option to bypass cache
            max_agents: Maximum number of agents to support
            max_steps: Maximum steps per episode
            continuous_simulation: If True, agents get new goals instead of terminating.
            snap_resolution: The resolution (in degrees) to snap bounds for caching.
        """
        self.bounds = bounds # Store original, precise bounds for simulation logic
        self.redis_client = redis_client # Use the passed-in client
        self.force_osm_refresh = force_osm_refresh
        self.max_agents = max_agents
        self.max_steps = max_steps
        self.continuous_simulation = continuous_simulation
        self.snap_resolution = snap_resolution # Store snap_resolution

        # --- Caching Logic ---
        # Calculate snapped bounds for fetching and caching OSM data
        snapped_fetch_bounds = self._generate_snapped_bounds(self.bounds, self.snap_resolution)
        logger.info(f"Original bounds for env: {self.bounds}")
        logger.info(f"Snapped bounds for OSM fetching/caching (resolution {self.snap_resolution}°): {snapped_fetch_bounds}")

        cache_key = self._generate_cache_key(snapped_fetch_bounds) # Use snapped_bounds for cache key
        cached_data = None
        
        if self.redis_client and not self.force_osm_refresh:
            try:
                serialized_data = self.redis_client.get(cache_key) # Returns bytes or None
                if serialized_data:
                    cached_data = pickle.loads(serialized_data)
            except (redis.RedisError, pickle.PickleError) as e:
                logger.warning(f"Could not load from cache: {e}")
                cached_data = None
        
        if cached_data:
            self.drive_graph_proj = cached_data['drive_graph_proj']
            self.graph_gdf_nodes_proj = cached_data['graph_gdf_nodes_proj']
            self.drive_graph_unproj = cached_data['drive_graph_unproj']
            self.graph_gdf_nodes_unproj = cached_data['graph_gdf_nodes_unproj']
            self.valid_vehicle_node_ids = cached_data['valid_vehicle_node_ids']
        else:
            north, south, east, west = snapped_fetch_bounds['maxLat'], snapped_fetch_bounds['minLat'], snapped_fetch_bounds['maxLng'], snapped_fetch_bounds['minLng']
            polygon = Polygon([(west, south), (west, north), (east, north), (east, south), (west, south)])
            
            try:
                G_unproj = ox.graph_from_polygon(polygon, network_type='drive', simplify=True) # polygon is from snapped_fetch_bounds
                self.drive_graph_unproj = G_unproj
                nodes_unproj = ox.graph_to_gdfs(G_unproj, nodes=True, edges=False)
                self.graph_gdf_nodes_unproj = nodes_unproj

                self.drive_graph_proj = ox.project_graph(G_unproj)
                if not self.drive_graph_proj:
                    self.graph_gdf_nodes_proj = None
                    self.valid_vehicle_node_ids = []
                else:
                    nodes_proj, _ = ox.graph_to_gdfs(self.drive_graph_proj, nodes=True, edges=True)
                    self.graph_gdf_nodes_proj = nodes_proj
                    if self.drive_graph_unproj:
                        self.valid_vehicle_node_ids = list(self.drive_graph_unproj.nodes)
                    else:
                         self.valid_vehicle_node_ids = []
            except Exception as e:
                 logger.exception(f"Failed to fetch or project drive graph: {e}")
                 self.drive_graph_proj = None 
                 self.graph_gdf_nodes_proj = None
                 self.drive_graph_unproj = None
                 self.graph_gdf_nodes_unproj = None
                 self.valid_vehicle_node_ids = []

            if self.redis_client:
                data_to_cache = {
                    'drive_graph_proj': self.drive_graph_proj,
                    'graph_gdf_nodes_proj': self.graph_gdf_nodes_proj,
                    'drive_graph_unproj': self.drive_graph_unproj,
                    'graph_gdf_nodes_unproj': self.graph_gdf_nodes_unproj,
                    'valid_vehicle_node_ids': self.valid_vehicle_node_ids
                }
                try:
                    serialized_data = pickle.dumps(data_to_cache)
                    self.redis_client.set(cache_key, serialized_data, ex=3153600000)
                except (redis.RedisError, pickle.PickleError, TypeError) as e:
                     logger.error(f"Failed to store data in Redis cache key {cache_key}: {e}")

        self.agents = {}  
        self.active_agents = set()  
        
        self.steps = 0
        
        logger.info(f"Finished initializing DriveGraphEnv. Continuous Simulation: {self.continuous_simulation}")

    def _generate_snapped_bounds(self, bounds: Dict[str, float], snap_resolution: float) -> Dict[str, float]:
        snapped_min_lat = math.floor(bounds["minLat"] / snap_resolution) * snap_resolution
        snapped_max_lat = math.ceil(bounds["maxLat"] / snap_resolution) * snap_resolution
        snapped_min_lng = math.floor(bounds["minLng"] / snap_resolution) * snap_resolution
        snapped_max_lng = math.ceil(bounds["maxLng"] / snap_resolution) * snap_resolution
        
        if snapped_max_lat <= snapped_min_lat:
            snapped_max_lat = snapped_min_lat + snap_resolution
        if snapped_max_lng <= snapped_min_lng:
            snapped_max_lng = snapped_min_lng + snap_resolution

        return {
            "minLat": snapped_min_lat,
            "maxLat": snapped_max_lat,
            "minLng": snapped_min_lng,
            "maxLng": snapped_max_lng,
        }

    def _generate_cache_key(self, bounds_for_cache: Dict[str, float]) -> str:
        bounds_str = json.dumps(bounds_for_cache, sort_keys=True) 
        key_hash = hashlib.sha256(bounds_str.encode('utf-8')).hexdigest()
        return f"drive_graph_data_v1:{key_hash}"

    def reset(self, seed=None) -> Dict[str, Any]:
        if seed is not None:
            np.random.seed(seed)
        
        self.steps = 0
        self.agents = {}
        self.active_agents = set()
        
        observations = {}
        infos = {}
        
        logger.info("Environment reset")
        return observations, infos
    
    def add_agent(self, 
                 agent_id: str) -> str:
        if len(self.agents) >= self.max_agents:
            logger.warning(f"Maximum agent count ({self.max_agents}) reached, cannot add more")
            return None
        
        agent_state = AgentState(
            agent_id=agent_id,
            position=np.zeros(2, dtype=np.float32),
            velocity=np.zeros(2, dtype=np.float32),
            goal=np.zeros(2, dtype=np.float32),
            path=None,
            path_index=0
        )

        if self.drive_graph_proj:
            try:
                if not self.valid_vehicle_node_ids:
                    return None
                start_node_id = np.random.choice(self.valid_vehicle_node_ids)
                if self.graph_gdf_nodes_unproj is None or start_node_id not in self.graph_gdf_nodes_unproj.index:
                     return None
                     
                start_node_geom = self.graph_gdf_nodes_unproj.loc[start_node_id].geometry
                if not isinstance(start_node_geom, Point):
                    return None
                agent_state.position = np.array([start_node_geom.y, start_node_geom.x], dtype=np.float32)

                goal_node_id = np.random.choice(self.valid_vehicle_node_ids)
                while goal_node_id == start_node_id:
                    goal_node_id = np.random.choice(self.valid_vehicle_node_ids)

                if goal_node_id in self.graph_gdf_nodes_unproj.index:
                   goal_node_geom = self.graph_gdf_nodes_unproj.loc[goal_node_id].geometry
                   if isinstance(goal_node_geom, Point):
                       agent_state.goal = np.array([goal_node_geom.y, goal_node_geom.x], dtype=np.float32)

                       new_path = nx.shortest_path(self.drive_graph_proj, source=start_node_id, target=goal_node_id, weight='length')
                       
                       if len(new_path) <= 1:
                           agent_state.path = None
                       else:
                           agent_state.path = new_path
                           agent_state.path_index = 0
            except (nx.NetworkXNoPath, nx.NodeNotFound) as e:
                 agent_state.path = None
            except Exception as e:
                 logger.exception(f"Error calculating path for vehicle {agent_id}: {e}")
                 agent_state.path = None
        
        self.agents[agent_id] = agent_state
        self.active_agents.add(agent_id)
        
        return agent_id
    
    def remove_agent(self, agent_id: str) -> bool:
        if agent_id in self.agents:
            del self.agents[agent_id]
            if agent_id in self.active_agents:
                self.active_agents.remove(agent_id)
            return True
        return False
    
    def step(self):
        self.steps += 1
        
        for agent_id in list(self.active_agents):
            agent = self.agents.get(agent_id)
            if not agent or not agent.path:
                continue

            if agent.path_index >= len(agent.path) - 1:
                if self.continuous_simulation:
                    self.recalculate_path(agent)
                else:
                    self.remove_agent(agent_id)
                continue

            current_node_id = agent.path[agent.path_index]
            next_node_id = agent.path[agent.path_index + 1]

            current_node_pos = self.get_node_position(current_node_id)
            next_node_pos = self.get_node_position(next_node_id)
            
            if current_node_pos is None or next_node_pos is None:
                continue

            direction_vector = next_node_pos - agent.position
            distance = np.linalg.norm(direction_vector)

            if distance > 0:
                agent.velocity = (direction_vector / distance) * MAX_SPEED

            if distance < MAX_SPEED:
                agent.position = next_node_pos
                agent.path_index += 1
            else:
                agent.position += agent.velocity
        
        return {agent_id: agent.to_tensor() for agent_id, agent in self.agents.items()}

    def get_node_position(self, node_id):
        if self.graph_gdf_nodes_unproj is not None and node_id in self.graph_gdf_nodes_unproj.index:
            node_geom = self.graph_gdf_nodes_unproj.loc[node_id].geometry
            if isinstance(node_geom, Point):
                return np.array([node_geom.y, node_geom.x], dtype=np.float32)
        return None

    def recalculate_path(self, agent):
        start_node_id = agent.path[-1]
        
        goal_node_id = np.random.choice(self.valid_vehicle_node_ids)
        while goal_node_id == start_node_id:
            goal_node_id = np.random.choice(self.valid_vehicle_node_ids)

        try:
            new_path = nx.shortest_path(self.drive_graph_proj, source=start_node_id, target=goal_node_id, weight='length')
            if len(new_path) > 1:
                agent.path = new_path
                agent.path_index = 0
                goal_pos = self.get_node_position(goal_node_id)
                if goal_pos is not None:
                    agent.goal = goal_pos
            else:
                self.remove_agent(agent.agent_id)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            self.remove_agent(agent.agent_id)

    def get_agent_states(self):
        return {
            agent_id: {
                "position": agent.position.tolist(),
                "path": [self.get_node_position(node_id).tolist() for node_id in agent.path if self.get_node_position(node_id) is not None] if agent.path else []
            } 
            for agent_id, agent in self.agents.items()
        }
