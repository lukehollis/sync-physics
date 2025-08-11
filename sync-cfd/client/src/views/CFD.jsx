import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min';
import { ArrowUpIcon, PlayIcon, PauseIcon, StopIcon, TrashIcon } from '@heroicons/react/24/solid';

const CFD = () => {
  // Three.js references
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const frameRef = useRef(null);
  const guiRef = useRef(null);
  
  // Visualization objects
  const meshRef = useRef(null);
  const vectorFieldRef = useRef(null);
  const streamlinesRef = useRef(null);
  const obstacleRef = useRef(null);
  const colorBarRef = useRef(null);
  
  // WebSocket reference
  const wsRef = useRef(null);
  
  // State
  const [simulations, setSimulations] = useState([]);
  const [selectedSim, setSelectedSim] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(1000);
  const [simulationData, setSimulationData] = useState(null);
  const [showVectors, setShowVectors] = useState(true);
  const [showStreamlines, setShowStreamlines] = useState(false);
  const [showPressure, setShowPressure] = useState(true);
  const [showVorticity, setShowVorticity] = useState(false);
  const [vectorScale, setVectorScale] = useState(0.05);
  
  // New simulation form
  const [newSimForm, setNewSimForm] = useState({
    name: 'CFD Simulation',
    gridSizeX: 200,
    gridSizeY: 80,
    inletVelocity: 1.0,
    fluidDensity: 1.0,
    viscosity: 0.01,
    timeSteps: 1000,
    dt: 0.01,
    obstacleType: 'cylinder',
    obstacleSize: 0.1
  });
  const [showNewSimForm, setShowNewSimForm] = useState(false);
  
  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 5, 15);
    sceneRef.current = scene;
    
    // Camera setup
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controlsRef.current = controls;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(4, 20, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);
    
    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    
    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      if (guiRef.current) {
        guiRef.current.destroy();
      }
    };
  }, []);
  
  // Fetch simulations list
  const fetchSimulations = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8003/api/cfd/simulations');
      const data = await response.json();
      setSimulations(data.simulations || []);
    } catch (error) {
      console.error('Error fetching simulations:', error);
    }
  }, []);
  
  useEffect(() => {
    fetchSimulations();
  }, [fetchSimulations]);
  
  // Create new simulation
  const createSimulation = async () => {
    try {
      const response = await fetch('http://localhost:8003/api/cfd/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSimForm.name,
          grid_size_x: newSimForm.gridSizeX,
          grid_size_y: newSimForm.gridSizeY,
          inlet_velocity: newSimForm.inletVelocity,
          fluid_density: newSimForm.fluidDensity,
          viscosity: newSimForm.viscosity,
          time_steps: newSimForm.timeSteps,
          dt: newSimForm.dt,
          obstacle_type: newSimForm.obstacleType,
          obstacle_size: newSimForm.obstacleSize,
          obstacle_position: [0.25, 0.5]
        })
      });
      
      const data = await response.json();
      setSelectedSim(data.simulation_id);
      setShowNewSimForm(false);
      fetchSimulations();
      
      // Connect to WebSocket for this simulation
      connectWebSocket(data.simulation_id);
    } catch (error) {
      console.error('Error creating simulation:', error);
    }
  };
  
  // Delete simulation
  const deleteSimulation = async (simId) => {
    try {
      await fetch(`http://localhost:8003/api/cfd/simulations/${simId}`, {
        method: 'DELETE'
      });
      
      if (selectedSim === simId) {
        setSelectedSim(null);
        clearVisualization();
      }
      
      fetchSimulations();
    } catch (error) {
      console.error('Error deleting simulation:', error);
    }
  };
  
  // WebSocket connection
  const connectWebSocket = (simId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const ws = new WebSocket('ws://localhost:8003/ws/cfd');
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      // Subscribe to simulation
      ws.send(JSON.stringify({
        type: 'subscribe',
        simulation_id: simId
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'simulation_update') {
        setSimulationData(data.data);
        setCurrentStep(data.data.step);
        updateVisualization(data.data);
      } else if (data.type === 'simulation_complete') {
        setIsRunning(false);
        console.log('Simulation completed');
      } else if (data.type === 'error') {
        console.error('WebSocket error:', data.message);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
  };
  
  // Start simulation
  const startSimulation = () => {
    if (!wsRef.current || !selectedSim) return;
    
    setIsRunning(true);
    wsRef.current.send(JSON.stringify({
      type: 'start'
    }));
  };
  
  // Stop simulation
  const stopSimulation = () => {
    if (!wsRef.current) return;
    
    setIsRunning(false);
    wsRef.current.send(JSON.stringify({
      type: 'stop'
    }));
  };
  
  // Clear visualization
  const clearVisualization = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    // Remove existing visualization objects
    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current = null;
    }
    if (vectorFieldRef.current) {
      scene.remove(vectorFieldRef.current);
      vectorFieldRef.current = null;
    }
    if (streamlinesRef.current) {
      scene.remove(streamlinesRef.current);
      streamlinesRef.current = null;
    }
    if (obstacleRef.current) {
      scene.remove(obstacleRef.current);
      obstacleRef.current = null;
    }
  };
  
  // Update visualization with new data
  const updateVisualization = (data) => {
    if (!data || !data.fields || !sceneRef.current) return;
    
    const scene = sceneRef.current;
    const { grid, fields } = data;
    
    // Clear previous visualization
    clearVisualization();
    
    // Create geometry for the flow field
    const geometry = new THREE.PlaneGeometry(2, 0.8, grid.nx - 1, grid.ny - 1);
    
    // Update vertex colors based on field data
    const colors = [];
    const fieldToVisualize = showVorticity ? fields.vorticity : 
                            showPressure ? fields.pressure : 
                            fields.velocity_magnitude;
    
    // Find min and max for normalization
    let minVal = Infinity, maxVal = -Infinity;
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        const val = fieldToVisualize[j][i];
        minVal = Math.min(minVal, val);
        maxVal = Math.max(maxVal, val);
      }
    }
    
    // Create color array
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        const val = fieldToVisualize[j][i];
        const normalized = (val - minVal) / (maxVal - minVal + 0.0001);
        
        // Use a color map (blue to red)
        const color = new THREE.Color();
        color.setHSL(0.7 - normalized * 0.7, 1.0, 0.5);
        colors.push(color.r, color.g, color.b);
      }
    }
    
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Create material
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -0.1;
    scene.add(mesh);
    meshRef.current = mesh;
    
    // Draw obstacle
    const obstacleGeometry = new THREE.BufferGeometry();
    const obstacleVertices = [];
    const obstacleColors = [];
    
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        if (fields.obstacle[j][i]) {
          const x = (i / (grid.nx - 1)) * 2 - 1;
          const y = (j / (grid.ny - 1)) * 0.8 - 0.4;
          
          // Create a small square for each obstacle point
          const size = 2 / grid.nx;
          obstacleVertices.push(
            x - size/2, y - size/2, 0,
            x + size/2, y - size/2, 0,
            x + size/2, y + size/2, 0,
            x - size/2, y - size/2, 0,
            x + size/2, y + size/2, 0,
            x - size/2, y + size/2, 0
          );
          
          // Gray color for obstacle
          for (let k = 0; k < 6; k++) {
            obstacleColors.push(0.3, 0.3, 0.3);
          }
        }
      }
    }
    
    if (obstacleVertices.length > 0) {
      obstacleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(obstacleVertices, 3));
      obstacleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(obstacleColors, 3));
      
      const obstacleMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
      });
      
      const obstacleMesh = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
      scene.add(obstacleMesh);
      obstacleRef.current = obstacleMesh;
    }
    
    // Draw velocity vectors if enabled
    if (showVectors && fields.u && fields.v) {
      const vectorGroup = new THREE.Group();
      
      // Sample vectors (don't draw all of them)
      const step = Math.max(2, Math.floor(grid.nx / 30));
      
      for (let j = 0; j < grid.ny; j += step) {
        for (let i = 0; i < grid.nx; i += step) {
          if (!fields.obstacle[j][i]) {
            const x = (i / (grid.nx - 1)) * 2 - 1;
            const y = (j / (grid.ny - 1)) * 0.8 - 0.4;
            const u = fields.u[j][i];
            const v = fields.v[j][i];
            
            const magnitude = Math.sqrt(u * u + v * v);
            if (magnitude > 0.01) {
              // Create arrow
              const direction = new THREE.Vector3(u, v, 0).normalize();
              const origin = new THREE.Vector3(x, y, 0);
              const length = magnitude * vectorScale;
              
              const arrowHelper = new THREE.ArrowHelper(
                direction,
                origin,
                length,
                0x00ff00,
                length * 0.3,
                length * 0.2
              );
              
              vectorGroup.add(arrowHelper);
            }
          }
        }
      }
      
      scene.add(vectorGroup);
      vectorFieldRef.current = vectorGroup;
    }
    
    // Request streamlines if enabled
    if (showStreamlines && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'get_streamlines'
      }));
    }
  };
  
  // Handle streamline visualization
  useEffect(() => {
    if (!wsRef.current) return;
    
    const handleStreamlines = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'streamline_update') {
        drawStreamlines(data.data);
      }
    };
    
    wsRef.current.addEventListener('message', handleStreamlines);
    
    return () => {
      if (wsRef.current) {
        wsRef.current.removeEventListener('message', handleStreamlines);
      }
    };
  }, [showStreamlines]);
  
  const drawStreamlines = (streamlineData) => {
    if (!sceneRef.current || !streamlineData) return;
    
    const scene = sceneRef.current;
    
    // Remove existing streamlines
    if (streamlinesRef.current) {
      scene.remove(streamlinesRef.current);
      streamlinesRef.current = null;
    }
    
    if (!showStreamlines) return;
    
    const streamlineGroup = new THREE.Group();
    
    streamlineData.streamlines.forEach((line, index) => {
      if (line.length < 2) return;
      
      const points = line.map(p => new THREE.Vector3(
        p[0] * 2 - 1,
        p[1] * 0.8 - 0.4,
        0.01
      ));
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(index / streamlineData.count, 1, 0.5),
        linewidth: 2
      });
      
      const streamline = new THREE.Line(geometry, material);
      streamlineGroup.add(streamline);
    });
    
    scene.add(streamlineGroup);
    streamlinesRef.current = streamlineGroup;
  };
  
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 p-4 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-cyan-400">CFD Simulations</h2>
        
        {/* Simulation List */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Available Simulations</h3>
          <div className="space-y-2">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  selectedSim === sim.id
                    ? 'bg-cyan-600 bg-opacity-30 border border-cyan-500'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => {
                  setSelectedSim(sim.id);
                  connectWebSocket(sim.id);
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{sim.name}</div>
                    <div className="text-sm text-gray-400">
                      Step: {sim.current_step}/{sim.total_steps}
                    </div>
                    <div className="text-xs text-gray-500">
                      Status: {sim.status}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSimulation(sim.id);
                    }}
                    className="p-1 hover:bg-red-600 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <button
            onClick={() => setShowNewSimForm(!showNewSimForm)}
            className="mt-4 w-full bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded transition-colors"
          >
            New Simulation
          </button>
        </div>
        
        {/* New Simulation Form */}
        {showNewSimForm && (
          <div className="mb-6 p-4 bg-gray-700 rounded">
            <h3 className="text-lg font-semibold mb-3">Create New Simulation</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={newSimForm.name}
                  onChange={(e) => setNewSimForm({...newSimForm, name: e.target.value})}
                  className="w-full px-2 py-1 bg-gray-800 rounded"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Grid X</label>
                  <input
                    type="number"
                    value={newSimForm.gridSizeX}
                    onChange={(e) => setNewSimForm({...newSimForm, gridSizeX: parseInt(e.target.value)})}
                    className="w-full px-2 py-1 bg-gray-800 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Grid Y</label>
                  <input
                    type="number"
                    value={newSimForm.gridSizeY}
                    onChange={(e) => setNewSimForm({...newSimForm, gridSizeY: parseInt(e.target.value)})}
                    className="w-full px-2 py-1 bg-gray-800 rounded"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm mb-1">Inlet Velocity</label>
                <input
                  type="number"
                  step="0.1"
                  value={newSimForm.inletVelocity}
                  onChange={(e) => setNewSimForm({...newSimForm, inletVelocity: parseFloat(e.target.value)})}
                  className="w-full px-2 py-1 bg-gray-800 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Viscosity</label>
                <input
                  type="number"
                  step="0.001"
                  value={newSimForm.viscosity}
                  onChange={(e) => setNewSimForm({...newSimForm, viscosity: parseFloat(e.target.value)})}
                  className="w-full px-2 py-1 bg-gray-800 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Obstacle Type</label>
                <select
                  value={newSimForm.obstacleType}
                  onChange={(e) => setNewSimForm({...newSimForm, obstacleType: e.target.value})}
                  className="w-full px-2 py-1 bg-gray-800 rounded"
                >
                  <option value="cylinder">Cylinder</option>
                  <option value="square">Square</option>
                  <option value="airfoil">Airfoil</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-1">Time Steps</label>
                <input
                  type="number"
                  value={newSimForm.timeSteps}
                  onChange={(e) => setNewSimForm({...newSimForm, timeSteps: parseInt(e.target.value)})}
                  className="w-full px-2 py-1 bg-gray-800 rounded"
                />
              </div>
              
              <button
                onClick={createSimulation}
                className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        )}
        
        {/* Visualization Controls */}
        {selectedSim && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Visualization</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showVectors}
                  onChange={(e) => setShowVectors(e.target.checked)}
                  className="mr-2"
                />
                Show Velocity Vectors
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showStreamlines}
                  onChange={(e) => setShowStreamlines(e.target.checked)}
                  className="mr-2"
                />
                Show Streamlines
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="field"
                  checked={showPressure}
                  onChange={() => {
                    setShowPressure(true);
                    setShowVorticity(false);
                  }}
                  className="mr-2"
                />
                Pressure Field
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="field"
                  checked={showVorticity}
                  onChange={() => {
                    setShowVorticity(true);
                    setShowPressure(false);
                  }}
                  className="mr-2"
                />
                Vorticity Field
              </label>
              
              <div>
                <label className="block text-sm mb-1">Vector Scale</label>
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={vectorScale}
                  onChange={(e) => setVectorScale(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Simulation Controls */}
        {selectedSim && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Controls</h3>
            <div className="flex gap-2">
              <button
                onClick={startSimulation}
                disabled={isRunning}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors flex items-center justify-center"
              >
                <PlayIcon className="w-5 h-5 mr-1" />
                Start
              </button>
              
              <button
                onClick={stopSimulation}
                disabled={!isRunning}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors flex items-center justify-center"
              >
                <StopIcon className="w-5 h-5 mr-1" />
                Stop
              </button>
            </div>
            
            <div className="mt-4">
              <div className="text-sm text-gray-400">
                Progress: {currentStep} / {totalSteps}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div
                  className="bg-cyan-500 h-2 rounded-full transition-all"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Stats */}
        {simulationData && simulationData.stats && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Statistics</h3>
            <div className="space-y-1 text-sm">
              <div>Max Velocity: {simulationData.stats.max_velocity.toFixed(3)}</div>
              <div>Min Pressure: {simulationData.stats.min_pressure.toFixed(3)}</div>
              <div>Max Pressure: {simulationData.stats.max_pressure.toFixed(3)}</div>
              <div>Max Vorticity: {simulationData.stats.max_vorticity.toFixed(3)}</div>
            </div>
          </div>
        )}
      </div>
      
      {/* 3D Visualization */}
      <div className="flex-1 relative">
        <div ref={mountRef} className="w-full h-full" />
        
        {/* Color Bar Legend */}
        <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-90 p-3 rounded">
          <div className="text-sm font-semibold mb-2">
            {showVorticity ? 'Vorticity' : showPressure ? 'Pressure' : 'Velocity'}
          </div>
          <div className="w-8 h-32 bg-gradient-to-t from-blue-500 via-green-500 to-red-500 rounded" />
          <div className="text-xs mt-1">High</div>
          <div className="text-xs mt-14">Low</div>
        </div>
        
        {/* Info Panel */}
        <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 p-3 rounded max-w-sm">
          <h3 className="font-semibold mb-1">CFD Simulation</h3>
          <p className="text-sm text-gray-300">
            Simulating fluid flow around an obstacle. Use the controls to start/stop
            the simulation and adjust visualization settings.
          </p>
          {selectedSim && (
            <p className="text-xs text-gray-400 mt-2">
              Simulation ID: {selectedSim}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CFD;
