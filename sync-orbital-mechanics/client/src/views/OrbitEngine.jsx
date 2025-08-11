import React, { useState, useEffect, useRef } from 'react';


import InfoPanel from '../components/InfoPanel';
import DebugConsole from '../components/DebugConsole';
import SolarSystem from '../components/SolarSystem';
import TrajectoryPlanner from '../components/TrajectoryPlanner';
import { 
  TimeControls, 
  BodyInfoPanel, 
  MissionPanel, 
  SimulationInfo 
} from '../components/ControlPanel';


export default function OrbitEngine() {
  // State management
  const [simulationState, setSimulationState] = useState({
    timestamp: 0,
    real_timestamp: new Date().toISOString(),
    bodies: {},
    missions: [],
    time_scale: 1,
    is_playing: true
  });
  
  const [selectedBody, setSelectedBody] = useState(null);
  const [bodyInfo, setBodyInfo] = useState(null);
  const [showPlanner, setShowPlanner] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  
  const wsRef = useRef(null);
  
  // WebSocket connection
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/ws/engine');
    
    ws.onopen = () => {
      console.log('Connected to Orbit Engine');
      setIsConnected(true);
      // Start the simulation automatically when connected
      ws.send(JSON.stringify({ type: 'control', action: 'play' }));
      // Set a reasonable default speed (1000x) so planets visibly move
      ws.send(JSON.stringify({ type: 'control', action: 'set_speed', speed: 1000 }));
      // Note: The server will send a "WebSocket connected successfully" status message
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'state_update') {
          setSimulationState(message.data);
        } else if (message.type === 'body_info') {
          setBodyInfo(message.data);
        } else if (message.type === 'status') {
          console.log('Status:', message.message);
          // Add status message to logs for debug console
          setLogs(prev => [...prev.slice(-49), { type: 'status', message: message.message }]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('Disconnected from Orbit Engine');
      setIsConnected(false);
      setLogs(prev => [...prev.slice(-49), { type: 'error', message: 'WebSocket disconnected - reconnecting in 3s...' }]);
      // Attempt to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
    
    wsRef.current = ws;
  };
  
  // Send WebSocket command
  const sendCommand = (command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(command));
    }
  };
  
  // Control handlers
  const handlePlayPause = () => {
    const action = simulationState.is_playing ? 'pause' : 'play';
    sendCommand({ type: 'control', action });
    
    // Also send via REST API for redundancy
    fetch('http://localhost:8000/api/control/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  };
  
  const handleSpeedChange = (speed) => {
    sendCommand({ type: 'control', action: 'set_speed', speed });
    
    // Also send via REST API
    fetch('http://localhost:8000/api/control/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_speed', speed })
    });
  };
  
  const handleBodyClick = async (bodyName) => {
    setSelectedBody(bodyName.toLowerCase());
    
    // Request body info via WebSocket
    sendCommand({ type: 'focus', body_name: bodyName });
    
    // Also fetch via REST API
    try {
      const response = await fetch('http://localhost:8000/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body_name: bodyName })
      });
      
      if (response.ok) {
        const info = await response.json();
        setBodyInfo(info);
      }
    } catch (error) {
      console.error('Error fetching body info:', error);
    }
  };
  
  const handleLaunchMission = (mission) => {
    console.log('Mission launched:', mission);
    // Mission will be added to state via WebSocket updates
  };
  
  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 w-full px-4 py-2 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 gap-4">
            <h1 className="text-white text-2xl font-bold">Orbit Engine</h1>
            <span className={`px-2 py-1 rounded text-xs ${
              isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <button
            onClick={() => setShowPlanner(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Plan Mission
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex">
        {/* 3D View */}
        <div className="fixed top-0 left-0 w-full h-full">
          <SolarSystem
            bodies={simulationState.bodies}
            missions={simulationState.missions}
            onBodyClick={handleBodyClick}
            selectedBody={selectedBody}
            timeScale={simulationState.time_scale}
          />
          
          {/* Overlaid simulation info */}
          <div className="fixed top-20 left-4">
            <SimulationInfo
              timestamp={simulationState.timestamp}
              realTime={simulationState.real_timestamp}
            />
          </div>
        </div>
        
        {/* Side panel */}
        <div className="fixed top-20 right-0 w-96 bg-transparentp-4 space-y-4 overflow-y-auto">
          <TimeControls
            isPlaying={simulationState.is_playing}
            timeScale={simulationState.time_scale}
            onPlayPause={handlePlayPause}
            onSpeedChange={handleSpeedChange}
          />
          
          {bodyInfo && (
            <BodyInfoPanel
              body={bodyInfo}
              onClose={() => {
                setBodyInfo(null);
                setSelectedBody(null);
              }}
            />
          )}
          
          <MissionPanel missions={simulationState.missions} />
        </div>
      </div>
      
      {/* Trajectory Planner Modal */}
      <TrajectoryPlanner
        isOpen={showPlanner}
        onClose={() => setShowPlanner(false)}
        onLaunchMission={handleLaunchMission}
      />

      {/* Debug Console for status messages */}
      <div className="fixed bottom-4 right-4 w-96 z-50">
        <DebugConsole logs={logs} />
      </div>
    </div>
  );
}
