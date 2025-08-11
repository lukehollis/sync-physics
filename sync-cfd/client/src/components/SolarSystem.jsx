import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Trail, Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// Planet component
function Planet({ name, position, radius, color, onClick, isSelected }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Add a subtle rotation for visual interest
      if (name !== 'Sun') {
        meshRef.current.rotation.y += 0.01;
      }
    }
  });

  const scale = name === 'Sun' ? 1 : (isSelected ? 1.2 : 1);
  
  // Configure material based on whether this is the Sun or a planet
  const isSun = name === 'Sun';
  
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={() => onClick(name)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={scale}
        castShadow={!isSun}
        receiveShadow={!isSun}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        {isSun ? (
          // Sun uses emissive material to glow
          <meshBasicMaterial
            color={color}
          />
        ) : (
          // Planets use standard material to receive light with slight emission for visibility
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.2}
            metalness={0.3}
            roughness={0.6}
          />
        )}
      </mesh>
      
      {/* Add a glow effect for the Sun */}
      {isSun && (
        <>
          {/* Inner glow */}
          <mesh scale={1.2}>
            <sphereGeometry args={[radius, 32, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3}
              side={THREE.BackSide}
            />
          </mesh>
          {/* Outer glow */}
          <mesh scale={1.5}>
            <sphereGeometry args={[radius, 32, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.1}
              side={THREE.BackSide}
            />
          </mesh>
        </>
      )}
      
      {/* Planet label - always visible and facing camera */}
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
        position={[0, radius * 2, 0]}
      >
        <Text
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
      </Billboard>
    </group>
  );
}

// Orbit ring component
function OrbitRing({ radius, color = '#ffffff' }) {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ));
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={0.5}
      opacity={0.3}
      transparent
    />
  );
}

// Spacecraft component
function Spacecraft({ position, trail = [] }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      // Make spacecraft pulse
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      meshRef.current.scale.setScalar(scale * 0.05);
    }
  });

  return (
    <group position={position}>
      {/* Spacecraft trail */}
      {trail.length > 1 && (
        <Trail
          width={0.1}
          length={trail.length}
          color="#00ff00"
          attenuation={(t) => t * t}
        >
          <mesh ref={meshRef} castShadow>
            <coneGeometry args={[0.02, 0.04, 4]} />
            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
          </mesh>
        </Trail>
      )}
      
      {/* Spacecraft mesh */}
      <mesh ref={meshRef} castShadow>
        <coneGeometry args={[0.02, 0.04, 4]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// Camera controller
function CameraController({ focusTarget }) {
  const { camera, gl } = useThree();
  
  useEffect(() => {
    if (focusTarget) {
      // Animate camera to focus on target
      camera.position.set(focusTarget[0] + 5, 5, focusTarget[2] + 5);
      camera.lookAt(focusTarget[0], focusTarget[1], focusTarget[2]);
    }
  }, [focusTarget, camera]);

  return <OrbitControls args={[camera, gl.domElement]} enablePan={true} enableZoom={true} enableRotate={true} />;
}

// Main solar system component
export default function SolarSystem({ bodies, missions, onBodyClick, selectedBody, timeScale }) {
  const [focusTarget, setFocusTarget] = useState(null);

  // Convert AU positions to scene units (1 AU = 10 units in scene)
  const sceneScale = 10;
  
  // Scale radii for visibility (not to real scale)
  const radiusScale = {
    'Sun': 1.0,
    'Mercury': 0.1,
    'Venus': 0.15,
    'Earth': 0.15,
    'Mars': 0.12,
    'Jupiter': 0.5,
    'Saturn': 0.45,
    'Uranus': 0.3,
    'Neptune': 0.3
  };

  // Brighter, more vibrant colors for planets
  const planetColors = {
    'Sun': '#FFD700',      // Bright gold
    'Mercury': '#E5E5E5',  // Bright silver/gray
    'Venus': '#FFD580',    // Bright peach/orange
    'Earth': '#4D94FF',    // Bright blue
    'Mars': '#FF6B6B',     // Bright red
    'Jupiter': '#FFB366',  // Bright orange-tan
    'Saturn': '#FFEB99',   // Bright pale yellow
    'Uranus': '#66FFE6',   // Bright cyan
    'Neptune': '#6B8FFF'   // Bright deep blue
  };

  useEffect(() => {
    if (selectedBody && bodies[selectedBody]) {
      const pos = bodies[selectedBody].position;
      setFocusTarget([pos[0] * sceneScale, pos[1] * sceneScale, pos[2] * sceneScale]);
    }
  }, [selectedBody, bodies]);

  return (
    <Canvas
      camera={{ position: [30, 30, 30], fov: 60 }}
      style={{ background: '#000000' }}
      shadows
    >
      {/* Lighting setup for realistic solar system */}
      {/* Very dim ambient light - just enough to see planet outlines */}
      <ambientLight intensity={0.02} />
      
      {/* Primary sun light - strong point light at sun position */}
      <pointLight 
        position={[0, 0, 0]} 
        intensity={3} 
        color="#FDB813"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={500}
        shadow-camera-near={0.5}
      />
      
      {/* Secondary sun light for better illumination */}
      <pointLight 
        position={[0, 0, 0]} 
        intensity={1} 
        color="#FFFFFF"
        distance={100}
      />
      
      {/* Stars background */}
      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade />

      <EffectComposer>
          <Bloom 
            intensity={0.9} 
            luminanceThreshold={0.4} 
            luminanceSmoothing={0} 
            toneMapped={false} 
          />
        </EffectComposer>
      
      {/* Camera controls */}
      <CameraController focusTarget={focusTarget} />
      
      {/* Render celestial bodies */}
      {Object.entries(bodies).map(([key, body]) => {
        const position = [
          body.position[0] * sceneScale,
          body.position[1] * sceneScale,
          body.position[2] * sceneScale
        ];
        
        return (
          <React.Fragment key={key}>
            {/* Orbit ring for planets */}
            {key !== 'sun' && (
              <OrbitRing
                radius={Math.sqrt(position[0] ** 2 + position[2] ** 2)}
                color="#ffffff"
              />
            )}
            
            {/* Planet/Sun */}
            <Planet
              name={body.name}
              position={position}
              radius={radiusScale[body.name] || 0.1}
              color={planetColors[body.name] || body.color}
              onClick={onBodyClick}
              isSelected={selectedBody === key}
            />
          </React.Fragment>
        );
      })}
      
      {/* Render missions/spacecraft */}
      {missions.map((mission) => {
        if (mission.status === 'active' && mission.current_position) {
          const position = [
            mission.current_position[0],
            mission.current_position[1],
            mission.current_position[2]
          ];
          
          return (
            <Spacecraft
              key={mission.id}
              position={position}
              trail={mission.trajectory || []}
            />
          );
        }
        return null;
      })}
      
      {/* Render mission trajectories */}
      {missions.map((mission) => {
        if (mission.trajectory && mission.trajectory.length > 1) {
          const points = mission.trajectory.map(point => 
            new THREE.Vector3(point.position[0], point.position[1], point.position[2])
          );
          
          return (
            <Line
              key={`trajectory-${mission.id}`}
              points={points}
              color="#00ff00"
              lineWidth={1}
              opacity={0.5}
              transparent
              dashed
            />
          );
        }
        return null;
      })}
    </Canvas>
  );
}
