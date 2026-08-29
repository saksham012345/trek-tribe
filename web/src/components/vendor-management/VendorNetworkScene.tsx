import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, Line } from '@react-three/drei';
import * as THREE from 'three';

interface CategoryNode {
  label: string;
  color: string;
  position: [number, number, number];
}

const CATEGORY_NODES: CategoryNode[] = [
  { label: 'Hotel', color: '#38BDF8', position: [2.4, 0.6, 0.4] },
  { label: 'Transport', color: '#EA580C', position: [-2.2, 1.1, -0.6] },
  { label: 'Guide', color: '#22C55E', position: [1.6, -1.4, 1.1] },
  { label: 'Equipment', color: '#A855F7', position: [-1.8, -1.0, -0.9] },
  { label: 'Food', color: '#F59E0B', position: [0.3, 1.8, -1.3] },
  { label: 'Photographer', color: '#EC4899', position: [-0.4, -1.9, 1.4] },
];

const CORE_POSITION = new THREE.Vector3(0, 0, 0);

function Core() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.85, 1]} />
      <meshStandardMaterial
        color="#0EA5E9"
        emissive="#0EA5E9"
        emissiveIntensity={0.6}
        roughness={0.25}
        metalness={0.4}
        wireframe={false}
      />
    </mesh>
  );
}

function CategoryNodeMesh({ node }: { node: CategoryNode }) {
  const points = useMemo(
    () => [CORE_POSITION, new THREE.Vector3(...node.position)],
    [node.position]
  );
  return (
    <>
      <Line points={points} color={node.color} lineWidth={1} transparent opacity={0.35} />
      <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
        <group position={node.position}>
          <mesh>
            <sphereGeometry args={[0.22, 24, 24]} />
            <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.5} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    pointer.current.x = state.pointer.x;
    pointer.current.y = state.pointer.y;
    if (groupRef.current) {
      groupRef.current.rotation.y += (pointer.current.x * 0.3 - groupRef.current.rotation.y) * 0.04;
      groupRef.current.rotation.x += (-pointer.current.y * 0.15 - groupRef.current.rotation.x) * 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 4, 4]} intensity={40} color="#38BDF8" />
      <pointLight position={[-4, -3, -2]} intensity={25} color="#EA580C" />
      <Core />
      {CATEGORY_NODES.map((node) => (
        <CategoryNodeMesh key={node.label} node={node} />
      ))}
      <Sparkles count={60} scale={7} size={2} speed={0.3} opacity={0.5} color="#7DD3FC" />
    </group>
  );
}

/**
 * The Vendor OS flagship visual: a small glowing "trip" core connected to
 * orbiting vendor-category nodes — a literal picture of what Vendor OS does
 * (one trip, many coordinated vendor relationships, one place to run them).
 * Renders nothing (falls back to the poster gradient behind it) if the
 * device has no WebGL or the user has requested reduced motion.
 */
const VendorNetworkScene: React.FC = () => {
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
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene />
    </Canvas>
  );
};

export default VendorNetworkScene;
