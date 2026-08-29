import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

function Marker() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
      meshRef.current.rotation.x += delta * 0.08;
    }
  });
  return (
    <Float speed={1.2} floatIntensity={0.6} rotationIntensity={0.2}>
      <mesh>
        <icosahedronGeometry args={[1.9, 0]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.3, 0]} />
        <meshStandardMaterial color="#22c55e" emissive="#4ade80" emissiveIntensity={0.6} roughness={0.25} metalness={0.35} flatShading />
      </mesh>
      <pointLight color="#4ade80" intensity={8} distance={8} />
      <Sparkles count={40} scale={[4, 4, 4]} size={2} speed={0.2} opacity={0.4} color="#a7f3d0" />
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 2]} intensity={0.8} color="#c4b5fd" />
      <Marker />
    </>
  );
}

/** Compact glowing waypoint marker for the pinned scroll-narrative section (not full-bleed). */
const PinnedWaypointScene: React.FC = () => {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return null;

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene />
    </Canvas>
  );
};

export default PinnedWaypointScene;
