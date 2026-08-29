import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface PeakSpec {
  x: number;
  z: number;
  height: number;
  radius: number;
  color: string;
}

// Three depth layers (far -> near) fake atmospheric perspective: farther
// peaks are paler/hazier, nearer peaks are darker and larger — the classic
// layered-mountain-range look, built entirely from low-poly cones.
const GROUND_Y = -3.4;

const PEAKS: PeakSpec[] = [
  { x: -4.2, z: -6, height: 1.8, radius: 1.7, color: '#CBEAF9' },
  { x: -1.0, z: -6.8, height: 2.1, radius: 2.0, color: '#BFE3F7' },
  { x: 3.4, z: -5.8, height: 1.6, radius: 1.6, color: '#D3EDFA' },
  { x: -2.6, z: -3.6, height: 1.3, radius: 1.5, color: '#7FBBD9' },
  { x: 1.8, z: -4.2, height: 1.5, radius: 1.7, color: '#6FAFD1' },
  { x: 0.2, z: -2.4, height: 1.0, radius: 1.8, color: '#3D7EA6' },
];

function Peak({ spec }: { spec: PeakSpec }) {
  return (
    <mesh position={[spec.x, spec.height / 2 + GROUND_Y, spec.z]}>
      <coneGeometry args={[spec.radius, spec.height, 5]} />
      <meshStandardMaterial
        color={spec.color}
        flatShading
        roughness={0.85}
        metalness={0.05}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    pointer.current.x = state.pointer.x;
    pointer.current.y = state.pointer.y;
    if (groupRef.current) {
      groupRef.current.rotation.y += (pointer.current.x * 0.12 - groupRef.current.rotation.y) * 0.03;
      groupRef.current.position.y += (pointer.current.y * 0.08 - groupRef.current.position.y) * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} color="#FFF4D6" />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#7EC8E3" />
      {PEAKS.map((spec, i) => (
        <Peak key={i} spec={spec} />
      ))}
      <Float speed={0.6} floatIntensity={0.15} rotationIntensity={0}>
        <Sparkles count={90} scale={[10, 3, 6]} size={1.6} speed={0.15} opacity={0.35} color="#FFFFFF" position={[0, 0.5, -1]} />
      </Float>
    </group>
  );
}

/**
 * Full-bleed 3D layer for the homepage hero — a low-poly mountain range with
 * drifting mist, sitting between the (CMS-configurable) photo background and
 * the headline text. Falls back to nothing (just the photo behind it) with
 * no WebGL or reduced motion, matching the Vendor OS scene's fallback rule.
 */
const HeroMountainScene: React.FC = () => {
  const supportsWebGL = useMemo(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }, []);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!supportsWebGL || prefersReducedMotion) return null;

  return (
    <Canvas
      camera={{ position: [0, 0.4, 6], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <Scene />
    </Canvas>
  );
};

export default HeroMountainScene;
