import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Box, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Drone 3D Component
function Drone({ position, rotation, thrusts = [0, 0, 0, 0] }) {
  const meshRef = useRef();
  const rotorRefs = useRef([]);
  
  useFrame((state, delta) => {
    // Animate rotors based on thrust
    rotorRefs.current.forEach((rotor, i) => {
      if (rotor) {
        rotor.rotation.y += (thrusts[i] * 50 + 10) * delta;
      }
    });
  });

  return (
    <group position={position} rotation={rotation} ref={meshRef}>
      {/* Drone body */}
      <Box args={[0.6, 0.1, 0.6]} castShadow>
        <meshStandardMaterial color="#2c3e50" metalness={0.8} roughness={0.2} />
      </Box>
      
      {/* Arms */}
      {[
        [0.4, 0, 0.4, 0],      // Front-right
        [-0.4, 0, 0.4, Math.PI/2],   // Front-left
        [-0.4, 0, -0.4, Math.PI],    // Back-left
        [0.4, 0, -0.4, -Math.PI/2]   // Back-right
      ].map((pos, i) => (
        <group key={i}>
          {/* Arm */}
          <Box position={[pos[0]/2, 0, pos[2]/2]} args={[Math.abs(pos[0]) || 0.02, 0.02, Math.abs(pos[2]) || 0.02]} castShadow>
            <meshStandardMaterial color="#34495e" />
          </Box>
          
          {/* Motor */}
          <group position={[pos[0], 0.05, pos[2]]}>
            <Box args={[0.08, 0.08, 0.08]} castShadow>
              <meshStandardMaterial color="#1a1a1a" />
            </Box>
            
            {/* Rotor */}
            <group position={[0, 0.06, 0]} ref={el => rotorRefs.current[i] = el}>
              <Box args={[0.3, 0.01, 0.05]} castShadow>
                <meshStandardMaterial 
                  color="#ff6347" 
                  opacity={0.8 + thrusts[i] * 0.2} 
                  transparent 
                />
              </Box>
              <Box args={[0.05, 0.01, 0.3]} castShadow>
                <meshStandardMaterial 
                  color="#ff6347" 
                  opacity={0.8 + thrusts[i] * 0.2} 
                  transparent 
                />
              </Box>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

// Target Marker Component
function TargetMarker({ position }) {
  return (
    <group position={position}>
      <Sphere args={[0.2, 16, 16]}>
        <meshStandardMaterial color="#2ecc71" opacity={0.3} transparent />
      </Sphere>
      <Sphere args={[0.1, 16, 16]}>
        <meshStandardMaterial color="#27ae60" emissive="#27ae60" emissiveIntensity={0.5} />
      </Sphere>
    </group>
  );
}

// 3D Scene Component
function Scene({ droneState, targetPosition }) {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(15, 10, 15);
    camera.lookAt(0, 5, 0);
  }, [camera]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -5]} intensity={0.5} />
      
      {/* Ground - Checkerboard pattern */}
      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2c3e50"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#34495e"
        fadeDistance={50}
        fadeStrength={1}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      
      {/* Reference ground plane for shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
      
      {/* Drone */}
      <Drone 
        position={droneState.position} 
        rotation={droneState.orientation}
        thrusts={droneState.thrusts}
      />
      
      {/* Target position marker */}
      <TargetMarker position={targetPosition} />
      
      {/* Trajectory trail (optional) */}
      {droneState.trail && droneState.trail.length > 1 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(droneState.trail.flat())}
              count={droneState.trail.length}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#3498db" opacity={0.5} transparent />
        </line>
      )}
      
      {/* Info text */}
      <Text
        position={[0, 15, 0]}
        fontSize={0.5}
        color="#ecf0f1"
        anchorX="center"
        anchorY="middle"
      >
        {`Episode: ${droneState.episode || 0} | Timestep: ${droneState.timestep || 0}`}
      </Text>
      
      <Text
        position={[0, 14, 0]}
        fontSize={0.4}
        color="#ecf0f1"
        anchorX="center"
        anchorY="middle"
      >
        {`Reward: ${droneState.reward?.toFixed(2) || 0} | Cumulative: ${droneState.cumulative_reward?.toFixed(2) || 0}`}
      </Text>
    </>
  );
}

// Main Drone Hovering Component
export default function DroneHovering() {
  const [droneState, setDroneState] = useState({
    position: [0, 10, 0],
    orientation: [0, 0, 0],
    velocity: [0, 0, 0],
    thrusts: [0, 0, 0, 0],
    episode: 0,
    timestep: 0,
    reward: 0,
    cumulative_reward: 0,
    trail: []
  });
  
  const [targetPosition] = useState([0, 10, 0]);
  const [isTraining, setIsTraining] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('PPO');
  const [trainingStats, setTrainingStats] = useState({
    episodes: [],
    rewards: [],
    mean_rewards: []
  });
  const [models, setModels] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const wsRef = useRef(null);
  const trailRef = useRef([]);
  const MAX_TRAIL_LENGTH = 100;
  
  // WebSocket connection
  useEffect(() => {
    connectWebSocket();
    fetchModels();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8001/ws/drone');
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'state_update') {
        const data = message.data;
        
        // Update trail
        if (data.position) {
          trailRef.current.push([...data.position]);
          if (trailRef.current.length > MAX_TRAIL_LENGTH) {
            trailRef.current.shift();
          }
        }
        
        setDroneState(prev => ({
          ...prev,
          position: data.position || prev.position,
          orientation: data.orientation || prev.orientation,
          velocity: data.velocity || prev.velocity,
          thrusts: data.thrusts || prev.thrusts,
          episode: data.episode || prev.episode,
          timestep: data.timestep || prev.timestep,
          reward: data.reward || prev.reward,
          cumulative_reward: data.cumulative_reward || prev.cumulative_reward,
          trail: [...trailRef.current]
        }));
      } else if (message.type === 'episode_complete') {
        const data = message.data;
        setTrainingStats(prev => ({
          episodes: [...prev.episodes, data.episode].slice(-100),
          rewards: [...prev.rewards, data.reward].slice(-100),
          mean_rewards: [...prev.mean_rewards, data.mean_reward].slice(-100)
        }));
        
        // Clear trail on episode complete
        trailRef.current = [];
      } else if (message.type === 'initial_state') {
        setIsTraining(message.data.is_training);
        if (message.data.training_stats) {
          setTrainingStats(message.data.training_stats);
        }
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };
    
    wsRef.current = ws;
  };
  
  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/drone/models');
      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };
  
  const startTraining = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'training',
        action: 'start',
        algorithm: selectedAlgorithm,
        timesteps: 100000
      }));
      setIsTraining(true);
    }
  };
  
  const stopTraining = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'training',
        action: 'stop'
      }));
      setIsTraining(false);
    }
  };
  
  const resetEnvironment = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'training',
        action: 'reset'
      }));
      trailRef.current = [];
      setDroneState(prev => ({ ...prev, trail: [] }));
    }
  };
  
  const saveModel = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const name = prompt('Enter model name:');
      if (name) {
        wsRef.current.send(JSON.stringify({
          type: 'model',
          action: 'save',
          name: name
        }));
        setTimeout(fetchModels, 1000);
      }
    }
  };
  
  const loadModel = (path) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'model',
        action: 'load',
        path: path
      }));
    }
  };
  
  // Chart data
  const chartData = {
    labels: trainingStats.episodes,
    datasets: [
      {
        label: 'Episode Reward',
        data: trainingStats.rewards,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.1
      },
      {
        label: 'Mean Reward (100 eps)',
        data: trainingStats.mean_rewards,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.1
      }
    ]
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Training Progress'
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Episode'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Reward'
        }
      }
    }
  };
  
  return (
    <div className="w-full h-screen flex bg-gray-900">
      {/* Main 3D View */}
      <div className="flex-1 relative">
        <Canvas shadows camera={{ fov: 50 }}>
          <Scene droneState={droneState} targetPosition={targetPosition} />
          <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
          />
        </Canvas>
        
        {/* Connection Status */}
        <div className="absolute top-4 left-4">
          <div className={`px-3 py-1 rounded text-sm font-semibold ${
            connectionStatus === 'connected' ? 'bg-green-600' :
            connectionStatus === 'error' ? 'bg-red-600' : 'bg-yellow-600'
          } text-white`}>
            {connectionStatus.toUpperCase()}
          </div>
        </div>
      </div>
      
      {/* Control Panel */}
      <div className="w-96 bg-gray-800 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Drone Training Dashboard</h2>
        
        {/* Training Controls */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Training Controls</h3>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Algorithm
            </label>
            <select 
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-600 text-white rounded"
              disabled={isTraining}
            >
              <option value="PPO">PPO</option>
              <option value="A2C">A2C</option>
              <option value="SAC">SAC</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={startTraining}
              disabled={isTraining || connectionStatus !== 'connected'}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Start Training
            </button>
            <button
              onClick={stopTraining}
              disabled={!isTraining}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Stop Training
            </button>
          </div>
          
          <button
            onClick={resetEnvironment}
            className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reset Environment
          </button>
        </div>
        
        {/* Model Management */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Model Management</h3>
          
          <button
            onClick={saveModel}
            className="w-full mb-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Save Model
          </button>
          
          {models.length > 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Load Model
              </label>
              <div className="max-h-32 overflow-y-auto">
                {models.map((model, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadModel(model.path)}
                    className="w-full text-left px-3 py-1 mb-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Training Progress Chart */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Training Progress</h3>
          <div className="h-64">
            {trainingStats.episodes.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No training data yet
              </div>
            )}
          </div>
        </div>
        
        {/* Current State Info */}
        <div className="p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Current State</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Episode:</span>
              <span className="text-white font-mono">{droneState.episode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Timestep:</span>
              <span className="text-white font-mono">{droneState.timestep}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Position:</span>
              <span className="text-white font-mono">
                [{droneState.position.map(p => p.toFixed(2)).join(', ')}]
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Velocity:</span>
              <span className="text-white font-mono">
                [{droneState.velocity.map(v => v.toFixed(2)).join(', ')}]
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Current Reward:</span>
              <span className="text-white font-mono">{droneState.reward.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cumulative Reward:</span>
              <span className="text-white font-mono">{droneState.cumulative_reward.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
