import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

/** Faceted glowing waypoint marker — the scene's centerpiece, echoing a compass/trail star. */
function WaypointMarker() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.25;
      meshRef.current.rotation.x += delta * 0.06;
    }
  });
  return (
    <Float speed={1.1} floatIntensity={0.5} rotationIntensity={0.15}>
      {/* soft halo behind the marker, approximating bloom without a post-processing pass */}
      <mesh>
        <icosahedronGeometry args={[2.15, 0]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.7, 0]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#4ade80"
          emissiveIntensity={0.65}
          roughness={0.25}
          metalness={0.35}
          flatShading
        />
      </mesh>
      <pointLight color="#4ade80" intensity={10} distance={9} />
    </Float>
  );
}

/** Small geometric travel-icon props built from primitives, floating around the marker. */
function IconProp({ position, color, children }: { position: [number, number, number]; color: string; children: React.ReactNode }) {
  return (
    <Float speed={1.4} floatIntensity={1.1} rotationIntensity={0.6}>
      <group position={position} scale={0.5}>
        {children}
      </group>
    </Float>
  );
}

function TentProp() {
  return (
    <mesh rotation={[0, Math.PI / 4, 0]}>
      <coneGeometry args={[0.9, 1.3, 4]} />
      <meshStandardMaterial color="#f59e0b" flatShading roughness={0.7} />
    </mesh>
  );
}

function CompassProp() {
  return (
    <group>
      <mesh>
        <torusGeometry args={[0.75, 0.14, 12, 24]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.25, 0.9, 6]} />
        <meshStandardMaterial color="#ef4444" flatShading />
      </mesh>
    </group>
  );
}

function BackpackProp() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1, 1.3, 0.6]} />
        <meshStandardMaterial color="#0ea5e9" flatShading roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.55, 0.1]}>
        <boxGeometry args={[0.6, 0.4, 0.5]} />
        <meshStandardMaterial color="#0284c7" flatShading roughness={0.75} />
      </mesh>
    </group>
  );
}

function PaperPlaneProp() {
  return (
    <mesh rotation={[0.3, 0, -0.5]}>
      <coneGeometry args={[0.5, 1.4, 3]} />
      <meshStandardMaterial color="#f8fafc" flatShading roughness={0.5} />
    </mesh>
  );
}

const PROP_LAYOUT: Array<{ position: [number, number, number]; color: string; Comp: React.FC }> = [
  { position: [-2.0, 1.7, -1], color: '#f59e0b', Comp: TentProp },
  { position: [2.4, 1.9, -0.6], color: '#e2e8f0', Comp: CompassProp },
  { position: [-1.6, -2.0, -0.4], color: '#0ea5e9', Comp: BackpackProp },
  { position: [2.6, -1.6, -1.2], color: '#f8fafc', Comp: PaperPlaneProp },
];

function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    pointer.current.x = state.pointer.x;
    pointer.current.y = state.pointer.y;
    if (groupRef.current) {
      groupRef.current.rotation.y += (pointer.current.x * 0.15 - groupRef.current.rotation.y) * 0.04;
      groupRef.current.rotation.x += (-pointer.current.y * 0.08 - groupRef.current.rotation.x) * 0.04;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={0.9} color="#c4b5fd" />
      <directionalLight position={[-4, -2, -3]} intensity={0.3} color="#22c55e" />

      {/* full-bleed starfield stays centered on the camera regardless of the marker's offset */}
      <Stars radius={40} depth={30} count={1800} factor={2.2} saturation={0} fade speed={0.4} />

      {/* Offset right + up so the centerpiece sits beside the left-aligned headline, not hidden behind it */}
      <group ref={groupRef} position={[2.6, 0.4, 0]}>
        <Sparkles count={60} scale={[6, 5, 6]} size={2} speed={0.2} opacity={0.4} color="#a7f3d0" />
        <WaypointMarker />
        {PROP_LAYOUT.map((p, i) => (
          <IconProp key={i} position={p.position} color={p.color}>
            <p.Comp />
          </IconProp>
        ))}
      </group>
    </>
  );
}

/**
 * Full-bleed immersive 3D hero centerpiece: a glowing faceted waypoint marker
 * orbited by small geometric travel props (tent, compass, backpack, paper
 * plane) over a starfield. Pointer-reactive tilt, no scroll-jacking. Falls
 * back to nothing (transparent) with no WebGL or reduced motion.
 */
const HeroImmersiveScene: React.FC = () => {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) return null;

  return (
    <Canvas
      camera={{ position: [0, 0.3, 6], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <Scene />
    </Canvas>
  );
};

export default HeroImmersiveScene;
