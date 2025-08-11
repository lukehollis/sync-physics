import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const InvertedPendulum = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRef = useRef(null);
  const cartRef = useRef(null);
  const pendulumRef = useRef(null);
  const wsRef = useRef(null);
  
  const [state, setState] = useState({
    x: 0,
    theta: 0,
    time: 0,
    applied_force: 0,
    is_running: true
  });
  
  const [forceValue, setForceValue] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [balanceTime, setBalanceTime] = useState(null);
  const [balanceActive, setBalanceActive] = useState(false);
  const [keyPressed, setKeyPressed] = useState({ left: false, right: false });

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 5);
    camera.lookAt(0, 1, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Add grid for better spatial reference
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Create track (rail)
    const trackGeometry = new THREE.BoxGeometry(6, 0.05, 0.2);
    const trackMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x666666,
      metalness: 0.8,
      roughness: 0.2
    });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.position.y = -0.025;
    track.castShadow = true;
    track.receiveShadow = true;
    scene.add(track);

    // Create cart
    const cartGroup = new THREE.Group();
    
    // Cart body
    const cartGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.3);
    const cartMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3498db,
      metalness: 0.3,
      roughness: 0.7
    });
    const cartMesh = new THREE.Mesh(cartGeometry, cartMaterial);
    cartMesh.castShadow = true;
    cartMesh.receiveShadow = true;
    cartGroup.add(cartMesh);

    // Cart wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.35);
    const wheelMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2c3e50,
      metalness: 0.6,
      roughness: 0.4
    });
    
    const wheel1 = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel1.rotation.z = Math.PI / 2;
    wheel1.position.set(0.15, -0.1, 0);
    wheel1.castShadow = true;
    cartGroup.add(wheel1);

    const wheel2 = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel2.rotation.z = Math.PI / 2;
    wheel2.position.set(-0.15, -0.1, 0);
    wheel2.castShadow = true;
    cartGroup.add(wheel2);

    cartGroup.position.y = 0.15;
    scene.add(cartGroup);
    cartRef.current = cartGroup;

    // Create pendulum
    const pendulumGroup = new THREE.Group();
    
    // Pendulum rod
    const rodGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1);
    const rodMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xe74c3c,
      metalness: 0.5,
      roughness: 0.5
    });
    const rod = new THREE.Mesh(rodGeometry, rodMaterial);
    rod.position.y = 0.5;
    rod.castShadow = true;
    pendulumGroup.add(rod);

    // Pendulum mass (bob)
    const bobGeometry = new THREE.SphereGeometry(0.08);
    const bobMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xc0392b,
      metalness: 0.3,
      roughness: 0.7
    });
    const bob = new THREE.Mesh(bobGeometry, bobMaterial);
    bob.position.y = 1;
    bob.castShadow = true;
    pendulumGroup.add(bob);

    // Joint (pivot point)
    const jointGeometry = new THREE.SphereGeometry(0.03);
    const jointMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x95a5a6,
      metalness: 0.8,
      roughness: 0.2
    });
    const joint = new THREE.Mesh(jointGeometry, jointMaterial);
    pendulumGroup.add(joint);

    pendulumGroup.position.y = 0.15;
    scene.add(pendulumGroup);
    pendulumRef.current = pendulumGroup;

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update scene based on state
  useEffect(() => {
    if (cartRef.current) {
      cartRef.current.position.x = state.x;
    }
    if (pendulumRef.current) {
      pendulumRef.current.position.x = state.x;
      pendulumRef.current.rotation.z = state.theta;
    }
  }, [state.x, state.theta]);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8002/ws/pendulum');
      
      ws.onopen = () => {
        console.log('Connected to pendulum simulation');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'state_update') {
          setState(message.data);
          if (message.data.balance_time !== undefined) {
            setBalanceTime(message.data.balance_time);
          }
          if (message.data.balance_active !== undefined) {
            setBalanceActive(message.data.balance_active);
          }
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from pendulum simulation');
        setIsConnected(false);
        // Reconnect after 2 seconds
        setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        setKeyPressed(prev => ({ ...prev, left: true }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'apply_force', 
            force: -forceValue 
          }));
        }
      } else if (event.key === 'ArrowRight') {
        setKeyPressed(prev => ({ ...prev, right: true }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'apply_force', 
            force: forceValue 
          }));
        }
      }
    };

    const handleKeyUp = (event) => {
      if (event.key === 'ArrowLeft') {
        setKeyPressed(prev => ({ ...prev, left: false }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'apply_force', 
            force: 0 
          }));
        }
      } else if (event.key === 'ArrowRight') {
        setKeyPressed(prev => ({ ...prev, right: false }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'apply_force', 
            force: 0 
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [forceValue]);

  const handleReset = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'reset',
        initial_angle: 0.01
      }));
    }
  };

  const handlePlayPause = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'control',
        action: state.is_running ? 'pause' : 'play'
      }));
    }
  };

  const handleBalanceChallenge = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'balance_challenge'
      }));
    }
  };

  const handleForceChange = (event) => {
    setForceValue(parseFloat(event.target.value));
  };

  const applyForceDirectly = (force) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'apply_force', 
        force: force 
      }));
    }
  };

  return (
    <div className="relative w-full h-screen bg-black">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Connection status */}
      <div className="absolute top-4 left-4 text-white">
        <div className={`flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Data overlay */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white p-4 rounded-lg font-mono text-sm">
        <div className="space-y-2">
          <div>Cart Position: {state.x?.toFixed(3)} m</div>
          <div>Pendulum Angle: {(state.theta * 180 / Math.PI).toFixed(1)}°</div>
          <div>Time: {state.time?.toFixed(2)} s</div>
          <div>Applied Force: {state.applied_force?.toFixed(1)} N</div>
          {balanceActive && (
            <div className="text-yellow-400">Balance Time: {balanceTime?.toFixed(2)} s</div>
          )}
          {!balanceActive && balanceTime !== null && (
            <div className="text-red-400">Final Balance: {balanceTime?.toFixed(2)} s</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white p-6 rounded-lg">
        <div className="space-y-4">
          {/* Force slider */}
          <div className="flex items-center gap-4">
            <label className="text-sm">Force:</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={forceValue}
              onChange={handleForceChange}
              className="w-48"
            />
            <span className="text-sm w-16 text-right">{forceValue.toFixed(1)} N</span>
          </div>

          {/* Button controls */}
          <div className="flex gap-2 justify-center">
            <button
              onMouseDown={() => applyForceDirectly(-forceValue)}
              onMouseUp={() => applyForceDirectly(0)}
              className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors ${keyPressed.left ? 'bg-blue-800' : ''}`}
            >
              ← Push Left
            </button>
            
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
            >
              Reset
            </button>

            <button
              onClick={handlePlayPause}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              {state.is_running ? 'Pause' : 'Play'}
            </button>

            <button
              onMouseDown={() => applyForceDirectly(forceValue)}
              onMouseUp={() => applyForceDirectly(0)}
              className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors ${keyPressed.right ? 'bg-blue-800' : ''}`}
            >
              Push Right →
            </button>
          </div>

          {/* Balance challenge */}
          <div className="flex justify-center">
            <button
              onClick={handleBalanceChallenge}
              className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 rounded transition-colors"
            >
              Start Balance Challenge
            </button>
          </div>

          <div className="text-xs text-gray-400 text-center">
            Use arrow keys or buttons to apply force
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvertedPendulum;
