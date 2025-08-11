import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Environment, useGLTF, Text, Box, Sphere, Cylinder, Cone } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

// WebSocket connection URL
const WS_URL = 'ws://localhost:8004/ws/anatomy';

// Anatomical System Colors
const SYSTEM_COLORS = {
  skeletal: '#F5F5DC',
  muscular: '#8B4513',
  nervous: '#FFD700',
  circulatory: '#DC143C',
  respiratory: '#87CEEB',
  digestive: '#FFA500',
  endocrine: '#9370DB',
  immune: '#32CD32'
};

// Simple geometric organ representations
const Heart = ({ visible, simulationData }) => {
  const meshRef = useRef();
  const [glow, setGlow] = useState(0);

  useFrame((state, delta) => {
    if (meshRef.current && simulationData?.heartbeat) {
      const cyclePos = simulationData.heartbeat.cycle_position || 0;
      // Pulsing effect based on cardiac cycle
      meshRef.current.scale.setScalar(1 + 0.1 * Math.sin(cyclePos * Math.PI * 2));
      
      // Glow effect for active parts
      if (simulationData.heartbeat.active_parts?.includes('ventricles')) {
        setGlow(1);
      } else {
        setGlow(Math.max(0, glow - delta * 2));
      }
    }
  });

  return (
    <group position={[0, 0.5, -0.2]} visible={visible}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial 
          color={SYSTEM_COLORS.circulatory} 
          emissive={SYSTEM_COLORS.circulatory}
          emissiveIntensity={glow * 0.5}
        />
      </mesh>
      {/* Aorta */}
      <Cylinder position={[0, 0.15, 0]} args={[0.02, 0.03, 0.2]} rotation={[0, 0, Math.PI / 6]}>
        <meshStandardMaterial color={SYSTEM_COLORS.circulatory} />
      </Cylinder>
      {/* Pulmonary artery */}
      <Cylinder position={[0.05, 0.12, 0]} args={[0.015, 0.02, 0.15]} rotation={[0, 0, -Math.PI / 6]}>
        <meshStandardMaterial color="#4169E1" />
      </Cylinder>
    </group>
  );
};

const Lungs = ({ visible, simulationData }) => {
  const leftLungRef = useRef();
  const rightLungRef = useRef();

  useFrame((state, delta) => {
    if (simulationData?.respiratory) {
      const cyclePos = simulationData.respiratory.cycle_position || 0;
      const expansion = 1 + 0.15 * Math.sin(cyclePos * Math.PI * 2);
      
      if (leftLungRef.current) {
        leftLungRef.current.scale.set(expansion, expansion, expansion);
      }
      if (rightLungRef.current) {
        rightLungRef.current.scale.set(expansion, expansion, expansion);
      }
    }
  });

  return (
    <group position={[0, 0.3, 0]} visible={visible}>
      {/* Left lung */}
      <mesh ref={leftLungRef} position={[-0.15, 0, 0]}>
        <coneGeometry args={[0.12, 0.35, 8]} />
        <meshStandardMaterial 
          color={SYSTEM_COLORS.respiratory} 
          transparent 
          opacity={0.7}
        />
      </mesh>
      {/* Right lung */}
      <mesh ref={rightLungRef} position={[0.15, 0, 0]}>
        <coneGeometry args={[0.12, 0.35, 8]} />
        <meshStandardMaterial 
          color={SYSTEM_COLORS.respiratory} 
          transparent 
          opacity={0.7}
        />
      </mesh>
    </group>
  );
};

const Brain = ({ visible, simulationData }) => {
  const brainRef = useRef();
  const [nerveActivity, setNerveActivity] = useState([]);

  useFrame((state, delta) => {
    if (brainRef.current && simulationData?.nerve_impulse) {
      // Create pulsing effect for nerve activity
      const intensity = simulationData.nerve_impulse.segments?.filter(s => s.is_active).length / 50 || 0;
      brainRef.current.material.emissiveIntensity = intensity;
    }
  });

  return (
    <group position={[0, 1.5, 0]} visible={visible}>
      <mesh ref={brainRef}>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshStandardMaterial 
          color="#FFC0CB"
          emissive="#FFD700"
          emissiveIntensity={0}
        />
      </mesh>
      {/* Spinal cord */}
      <Cylinder position={[0, -0.3, 0]} args={[0.02, 0.02, 0.6]}>
        <meshStandardMaterial color={SYSTEM_COLORS.nervous} />
      </Cylinder>
    </group>
  );
};

const SkeletalSystem = ({ visible }) => {
  return (
    <group visible={visible}>
      {/* Skull */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
      </mesh>
      
      {/* Spine */}
      <Cylinder position={[0, 0.5, 0]} args={[0.03, 0.03, 1.8]}>
        <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
      </Cylinder>
      
      {/* Ribs */}
      {[...Array(12)].map((_, i) => (
        <group key={i} position={[0, 0.8 - i * 0.08, 0]}>
          <Cylinder 
            position={[-0.15, 0, 0]} 
            rotation={[0, 0, Math.PI / 2]}
            args={[0.01, 0.01, 0.3]}
          >
            <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
          </Cylinder>
          <Cylinder 
            position={[0.15, 0, 0]} 
            rotation={[0, 0, Math.PI / 2]}
            args={[0.01, 0.01, 0.3]}
          >
            <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
          </Cylinder>
        </group>
      ))}
      
      {/* Pelvis */}
      <Box position={[0, -0.5, 0]} args={[0.35, 0.2, 0.15]}>
        <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
      </Box>
      
      {/* Arms */}
      <Cylinder position={[-0.35, 0.5, 0]} args={[0.03, 0.03, 0.6]} rotation={[0, 0, Math.PI / 6]}>
        <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
      </Cylinder>
      <Cylinder position={[0.35, 0.5, 0]} args={[0.03, 0.03, 0.6]} rotation={[0, 0, -Math.PI / 6]}>
        <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
      </Cylinder>
      
      {/* Legs */}
      <Cylinder position={[-0.1, -0.9, 0]} args={[0.04, 0.04, 0.8]}>
        <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
      </Cylinder>
      <Cylinder position={[0.1, -0.9, 0]} args={[0.04, 0.04, 0.8]}>
        <meshStandardMaterial color={SYSTEM_COLORS.skeletal} />
      </Cylinder>
    </group>
  );
};

const DigestiveSystem = ({ visible, simulationData }) => {
  const stomachRef = useRef();
  const intestineRefs = useRef([]);

  useFrame((state, delta) => {
    if (simulationData?.digestion && stomachRef.current) {
      const peristalsis = simulationData.digestion.peristalsis_cycle || 0;
      stomachRef.current.scale.set(
        1 + 0.1 * Math.sin(peristalsis * Math.PI * 2),
        1,
        1 + 0.1 * Math.sin(peristalsis * Math.PI * 2)
      );
    }
  });

  return (
    <group visible={visible}>
      {/* Esophagus */}
      <Cylinder position={[0, 0.8, -0.05]} args={[0.02, 0.02, 0.6]}>
        <meshStandardMaterial color={SYSTEM_COLORS.digestive} />
      </Cylinder>
      
      {/* Stomach */}
      <mesh ref={stomachRef} position={[-0.05, 0.3, -0.05]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={SYSTEM_COLORS.digestive} />
      </mesh>
      
      {/* Small intestine (simplified coil) */}
      <group position={[0, -0.1, 0]}>
        {[...Array(5)].map((_, i) => (
          <Cylinder 
            key={i}
            ref={el => intestineRefs.current[i] = el}
            position={[Math.sin(i) * 0.1, -i * 0.1, Math.cos(i) * 0.05]}
            args={[0.02, 0.02, 0.2]}
            rotation={[Math.PI / 4, i * Math.PI / 3, 0]}
          >
            <meshStandardMaterial color="#FFA07A" />
          </Cylinder>
        ))}
      </group>
      
      {/* Large intestine */}
      <Cylinder position={[0.1, -0.4, 0]} args={[0.03, 0.03, 0.3]} rotation={[0, 0, Math.PI / 4]}>
        <meshStandardMaterial color="#CD853F" />
      </Cylinder>
    </group>
  );
};

const NervousSystem = ({ visible, simulationData }) => {
  const nerveRefs = useRef([]);
  
  useFrame((state, delta) => {
    if (simulationData?.nerve_impulse?.segments) {
      simulationData.nerve_impulse.segments.forEach((segment, i) => {
        if (nerveRefs.current[i]) {
          const intensity = segment.is_active ? 1 : 0;
          nerveRefs.current[i].material.emissiveIntensity = intensity;
        }
      });
    }
  });

  // Major nerve pathways
  const nervePathways = [
    { start: [0, 1.2, 0], end: [-0.4, 0.2, 0] }, // Brachial plexus left
    { start: [0, 1.2, 0], end: [0.4, 0.2, 0] },  // Brachial plexus right
    { start: [0, 0, 0], end: [-0.15, -1.2, 0] }, // Sciatic left
    { start: [0, 0, 0], end: [0.15, -1.2, 0] },  // Sciatic right
    { start: [0, 0.8, 0], end: [-0.3, 0.8, 0.1] }, // Radial left
    { start: [0, 0.8, 0], end: [0.3, 0.8, 0.1] },  // Radial right
  ];

  return (
    <group visible={visible}>
      {nervePathways.map((pathway, i) => {
        const direction = new THREE.Vector3(...pathway.end).sub(new THREE.Vector3(...pathway.start));
        const length = direction.length();
        const midpoint = new THREE.Vector3(...pathway.start).add(direction.multiplyScalar(0.5));
        
        return (
          <mesh
            key={i}
            ref={el => nerveRefs.current[i] = el}
            position={midpoint.toArray()}
            rotation={[0, 0, Math.atan2(direction.y, direction.x) - Math.PI / 2]}
          >
            <cylinderGeometry args={[0.005, 0.005, length, 8]} />
            <meshStandardMaterial 
              color={SYSTEM_COLORS.nervous}
              emissive="#FFFF00"
              emissiveIntensity={0}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// Human body container
const HumanBody = ({ systemVisibility, simulationData, onOrganClick }) => {
  const groupRef = useRef();

  return (
    <group ref={groupRef}>
      {/* Base body mesh (semi-transparent) */}
      <mesh>
        <cylinderGeometry args={[0.3, 0.4, 2, 16]} />
        <meshStandardMaterial 
          color="#FDB5A0" 
          transparent 
          opacity={0.2} 
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Anatomical Systems */}
      <SkeletalSystem visible={systemVisibility.skeletal} />
      <Heart visible={systemVisibility.circulatory} simulationData={simulationData} />
      <Lungs visible={systemVisibility.respiratory} simulationData={simulationData} />
      <Brain visible={systemVisibility.nervous} simulationData={simulationData} />
      <DigestiveSystem visible={systemVisibility.digestive} simulationData={simulationData} />
      <NervousSystem visible={systemVisibility.nervous} simulationData={simulationData} />
      
      {/* Interactive organ markers */}
      <Html position={[0, 0.5, 0.2]} style={{ pointerEvents: 'auto' }}>
        <div 
          className="organ-marker"
          onClick={() => onOrganClick('heart')}
          style={{ 
            cursor: 'pointer', 
            padding: '2px 6px', 
            background: 'rgba(220, 20, 60, 0.7)',
            color: 'white',
            borderRadius: '4px',
            fontSize: '10px'
          }}
        >
          Heart
        </div>
      </Html>
      
      <Html position={[0, 1.5, 0.2]} style={{ pointerEvents: 'auto' }}>
        <div 
          className="organ-marker"
          onClick={() => onOrganClick('brain')}
          style={{ 
            cursor: 'pointer', 
            padding: '2px 6px', 
            background: 'rgba(255, 192, 203, 0.7)',
            color: 'white',
            borderRadius: '4px',
            fontSize: '10px'
          }}
        >
          Brain
        </div>
      </Html>
      
      <Html position={[-0.15, 0.3, 0.2]} style={{ pointerEvents: 'auto' }}>
        <div 
          className="organ-marker"
          onClick={() => onOrganClick('lungs')}
          style={{ 
            cursor: 'pointer', 
            padding: '2px 6px', 
            background: 'rgba(135, 206, 235, 0.7)',
            color: 'white',
            borderRadius: '4px',
            fontSize: '10px'
          }}
        >
          Lungs
        </div>
      </Html>
    </group>
  );
};

// UI Panels
const SystemPanel = ({ systemVisibility, onToggleSystem }) => {
  const systems = [
    { id: 'skeletal', name: 'Skeletal System', icon: '🦴' },
    { id: 'muscular', name: 'Muscular System', icon: '💪' },
    { id: 'nervous', name: 'Nervous System', icon: '🧠' },
    { id: 'circulatory', name: 'Circulatory System', icon: '❤️' },
    { id: 'respiratory', name: 'Respiratory System', icon: '🫁' },
    { id: 'digestive', name: 'Digestive System', icon: '🍽️' },
  ];

  return (
    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 text-white w-64">
      <h3 className="text-lg font-bold mb-3 text-cyan-400">Anatomical Systems</h3>
      <div className="space-y-2">
        {systems.map(system => (
          <label key={system.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 p-2 rounded">
            <input
              type="checkbox"
              checked={systemVisibility[system.id] || false}
              onChange={() => onToggleSystem(system.id)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">{system.icon}</span>
            <span className="text-sm">{system.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const SimulationPanel = ({ ws, activeSimulations }) => {
  const simulations = [
    { id: 'heartbeat', name: 'Heartbeat', icon: '💓' },
    { id: 'nerve_impulse', name: 'Nerve Impulse', icon: '⚡' },
    { id: 'respiratory', name: 'Breathing', icon: '🌬️' },
    { id: 'blood_flow', name: 'Blood Flow', icon: '🩸' },
    { id: 'digestion', name: 'Digestion', icon: '🍴' },
  ];

  const handleToggleSimulation = (simulationType) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const action = activeSimulations.includes(simulationType) ? 'stop' : 'start';
      ws.send(JSON.stringify({
        action: action,
        simulation: simulationType
      }));
    }
  };

  return (
    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 text-white w-64">
      <h3 className="text-lg font-bold mb-3 text-green-400">Simulations</h3>
      <div className="space-y-2">
        {simulations.map(sim => (
          <button
            key={sim.id}
            onClick={() => handleToggleSimulation(sim.id)}
            className={`w-full flex items-center space-x-2 p-2 rounded transition-all ${
              activeSimulations.includes(sim.id) 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <span>{sim.icon}</span>
            <span className="text-sm">{sim.name}</span>
            {activeSimulations.includes(sim.id) && (
              <span className="ml-auto text-xs">Active</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

const InfoPanel = ({ organInfo, onClose }) => {
  if (!organInfo) return null;

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-md rounded-lg p-6 text-white max-w-md">
      <button 
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-white"
      >
        ✕
      </button>
      <h3 className="text-xl font-bold mb-2 text-blue-400">{organInfo.name}</h3>
      <p className="text-sm text-gray-300 mb-2">System: {organInfo.system}</p>
      <p className="text-sm mb-3">{organInfo.function}</p>
      {organInfo.weight && <p className="text-xs text-gray-400">Weight: {organInfo.weight}</p>}
      {organInfo.size && <p className="text-xs text-gray-400">Size: {organInfo.size}</p>}
      {organInfo.facts && (
        <div className="mt-3">
          <h4 className="text-sm font-semibold mb-1 text-cyan-400">Interesting Facts:</h4>
          <ul className="text-xs space-y-1">
            {organInfo.facts.map((fact, i) => (
              <li key={i} className="text-gray-300">• {fact}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const VitalSignsPanel = ({ simulationData }) => {
  const heartRate = simulationData?.heartbeat?.heart_rate || 70;
  const systolic = simulationData?.heartbeat?.blood_pressure?.systolic || 120;
  const diastolic = simulationData?.heartbeat?.blood_pressure?.diastolic || 80;
  const respiratoryRate = simulationData?.respiratory?.respiratory_rate || 16;
  const o2Saturation = simulationData?.respiratory?.o2_saturation || 97;

  return (
    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 text-white">
      <h3 className="text-lg font-bold mb-3 text-red-400">Vital Signs</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Heart Rate:</span>
          <span className="font-mono text-green-400">{Math.round(heartRate)} BPM</span>
        </div>
        <div className="flex justify-between">
          <span>Blood Pressure:</span>
          <span className="font-mono text-green-400">
            {Math.round(systolic)}/{Math.round(diastolic)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Respiratory Rate:</span>
          <span className="font-mono text-green-400">{respiratoryRate} /min</span>
        </div>
        <div className="flex justify-between">
          <span>O₂ Saturation:</span>
          <span className="font-mono text-green-400">{Math.round(o2Saturation)}%</span>
        </div>
      </div>
    </div>
  );
};

// ECG Monitor Component
const ECGMonitor = ({ ecgData }) => {
  const canvasRef = useRef();
  const dataRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Add new ECG value to data
    if (ecgData !== undefined) {
      dataRef.current.push(ecgData);
      if (dataRef.current.length > width) {
        dataRef.current.shift();
      }
    }

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Draw ECG trace
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    dataRef.current.forEach((value, i) => {
      const x = i;
      const y = height / 2 - value * height / 3;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }, [ecgData]);

  return (
    <div className="absolute bottom-4 left-4 bg-black rounded-lg p-2">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={100}
        className="border border-green-900"
      />
      <p className="text-green-400 text-xs mt-1 text-center">ECG Monitor</p>
    </div>
  );
};

// Main Component
const HumanAnatomy = () => {
  const [ws, setWs] = useState(null);
  const [simulationData, setSimulationData] = useState({});
  const [activeSimulations, setActiveSimulations] = useState([]);
  const [systemVisibility, setSystemVisibility] = useState({
    skeletal: true,
    muscular: false,
    nervous: false,
    circulatory: true,
    respiratory: false,
    digestive: false,
  });
  const [selectedOrgan, setSelectedOrgan] = useState(null);
  const [organInfo, setOrganInfo] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log('Connected to anatomy simulation');
      setConnectionStatus('connected');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'simulation_update') {
        setSimulationData(data.data.data || {});
        setActiveSimulations(data.data.active_simulations || []);
      } else if (data.type === 'organ_info') {
        setOrganInfo(data.data);
      } else if (data.type === 'status' && data.status === 'started') {
        console.log('Started simulation:', data.simulation);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    };

    websocket.onclose = () => {
      console.log('Disconnected from anatomy simulation');
      setConnectionStatus('disconnected');
      setWs(null);
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  const handleToggleSystem = (systemId) => {
    setSystemVisibility(prev => ({
      ...prev,
      [systemId]: !prev[systemId]
    }));
  };

  const handleOrganClick = (organId) => {
    setSelectedOrgan(organId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'get_organ_info',
        organ_id: organId
      }));
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-gray-900 via-blue-900 to-black relative overflow-hidden">
      {/* Connection Status */}
      <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs ${
        connectionStatus === 'connected' ? 'bg-green-600' : 
        connectionStatus === 'error' ? 'bg-red-600' : 'bg-yellow-600'
      } text-white z-50`}>
        {connectionStatus === 'connected' ? '● Connected' : 
         connectionStatus === 'error' ? '● Error' : '● Connecting...'}
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#000814']} />
        <fog attach="fog" args={['#000814', 5, 15]} />
        
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0077ff" />
        <spotLight
          position={[0, 5, 5]}
          angle={0.3}
          penumbra={0.5}
          intensity={0.8}
          castShadow
        />

        {/* Human Body Model */}
        <HumanBody 
          systemVisibility={systemVisibility}
          simulationData={simulationData}
          onOrganClick={handleOrganClick}
        />

        {/* Camera Controls */}
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
          autoRotate={false}
        />

        {/* Post-processing effects */}
        <EffectComposer>
          <Bloom 
            intensity={0.5}
            luminanceThreshold={0.6}
            luminanceSmoothing={0.9}
          />
        </EffectComposer>
      </Canvas>

      {/* UI Panels */}
      <SystemPanel 
        systemVisibility={systemVisibility}
        onToggleSystem={handleToggleSystem}
      />
      
      <SimulationPanel 
        ws={ws}
        activeSimulations={activeSimulations}
      />
      
      <InfoPanel 
        organInfo={organInfo}
        onClose={() => setOrganInfo(null)}
      />
      
      {activeSimulations.includes('heartbeat') && (
        <>
          <VitalSignsPanel simulationData={simulationData} />
          <ECGMonitor ecgData={simulationData?.heartbeat?.ecg_value} />
        </>
      )}

      {/* Title */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-wider">
          ANATOME
        </h1>
        <p className="text-cyan-400 text-sm">Interactive Human Anatomy Viewer</p>
      </div>
    </div>
  );
};

export default HumanAnatomy;
