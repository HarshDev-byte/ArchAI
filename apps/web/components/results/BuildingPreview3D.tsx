"use client";

import { useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { LayoutRecord } from "./LayoutSelector";

// ─────────────────────────────────────────────────────────────
// Building geometry helpers
// ─────────────────────────────────────────────────────────────

const SCALE_FT = 0.025; // ft → Three.js units (1 unit ≈ 40 ft)
const FL_H     = 0.15;  // height per floor in Three.js units

interface Block {
  pos:   [number, number, number];
  scale: [number, number, number];
}

function buildingBlocks(
  shape:   string,
  widthFt: number,
  depthFt: number,
  floors:  number,
): Block[] {
  const w = widthFt * SCALE_FT;
  const d = depthFt * SCALE_FT;
  const h = floors * FL_H;

  switch (shape.toLowerCase()) {
    case "l-shaped": return [
      { pos: [0,      h / 2, d / 4],   scale: [w, h, d / 2] },
      { pos: [-w / 4, h / 2, -d / 4],  scale: [w / 2, h, d / 2] },
    ];
    case "u-shaped": return [
      { pos: [0,      h / 2,  d / 3],    scale: [w, h, d / 3] },
      { pos: [-w * .35, h / 2, -d / 6], scale: [w * .3, h, d * .6] },
      { pos: [ w * .35, h / 2, -d / 6], scale: [w * .3, h, d * .6] },
    ];
    case "courtyard": return [
      { pos: [0,      h / 2,  d / 2],  scale: [w, h, d * .15] },
      { pos: [0,      h / 2, -d / 2],  scale: [w, h, d * .15] },
      { pos: [-w / 2, h / 2,  0],      scale: [w * .15, h, d] },
      { pos: [ w / 2, h / 2,  0],      scale: [w * .15, h, d] },
    ];
    case "tower": return [
      { pos: [0, h / 2, 0], scale: [w * .55, h, d * .55] },
    ];
    case "y-shaped": return [
      { pos: [0,       h / 2,  0],     scale: [w * .25, h, d * .25] },
      { pos: [0,       h / 2,  d / 2], scale: [w * .18, h, d / 2]   },
      { pos: [-w / 2,  h / 2, -d / 4], scale: [w / 2,  h, d * .18]  },
      { pos: [ w / 2,  h / 2, -d / 4], scale: [w / 2,  h, d * .18]  },
    ];
    default: // rectangular
      return [{ pos: [0, h / 2, 0], scale: [w, h, d] }];
  }
}

// ─────────────────────────────────────────────────────────────
// Animated building mesh with subtle float
// ─────────────────────────────────────────────────────────────

function BuildingBlock({ pos, scale, color }: Block & { color: string }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    ref.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 0.6) * 0.005;
  });
  return (
    <mesh ref={ref} position={pos} castShadow receiveShadow>
      <boxGeometry args={scale} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// Window grid overlay on each block face
function WindowOverlay({ pos, scale }: Block) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    ref.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 0.6) * 0.005;
  });
  return (
    <mesh ref={ref} position={[pos[0], pos[1], pos[2] + scale[2] / 2 + 0.001]}>
      <planeGeometry args={[scale[0] * 0.9, scale[1] * 0.95]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.04}
        wireframe
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Full 3D scene
// ─────────────────────────────────────────────────────────────

interface SceneProps {
  layout: LayoutRecord;
}

const COLORS = ["#7F77DD", "#9f7aea", "#6366f1"]; // purple palette per tier

function Scene({ layout }: SceneProps) {
  const fp         = layout.floor_plan;
  const shape      = fp.footprint.shape;
  const widthFt    = fp.footprint.width_ft;
  const depthFt    = fp.footprint.depth_ft;
  const floors     = fp.floors;
  const blocks     = buildingBlocks(shape, widthFt, depthFt, floors);
  const baseColor  = COLORS[layout.design_seed < 33 ? 0 : layout.design_seed < 67 ? 1 : 2];

  const totalH = floors * FL_H;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3, 4, -5]} intensity={0.3} color="#a78bfa" />

      {/* Environment */}
      <Environment preset="city" />

      {/* Building blocks */}
      {blocks.map((b, i) => (
        <group key={i}>
          <BuildingBlock {...b} color={baseColor} />
          <WindowOverlay {...b} />
        </group>
      ))}

      {/* Roof accent — glowing cap */}
      <mesh position={[0, totalH + 0.01, 0]}>
        <boxGeometry args={[
          Math.min(widthFt * SCALE_FT, 0.8),
          0.015,
          Math.min(depthFt * SCALE_FT, 0.8),
        ]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7F77DD" emissiveIntensity={1.5} />
      </mesh>

      {/* Floor label */}
      <Text
        position={[0, totalH + 0.12, 0]}
        fontSize={0.08}
        color="rgba(255, 255, 255, 0.7)"
        anchorX="center"
        anchorY="middle"
      >
        {floors}F
      </Text>

      {/* Ground & grid */}
      <Grid
        infiniteGrid
        cellSize={0.5}
        sectionSize={2}
        fadeDistance={12}
        cellColor="#7F77DD"
        sectionColor="#7F77DD"
        cellThickness={0.3}
        sectionThickness={0.6}
        fadeStrength={2}
      />

      {/* Camera controls */}
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enableZoom
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={1.5}
        maxDistance={8}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Exported component (dynamic import — no SSR)
// ─────────────────────────────────────────────────────────────

interface BuildingPreview3DProps {
  layout: LayoutRecord | null;
}

export default function BuildingPreview3D({ layout }: BuildingPreview3DProps) {
  if (!layout) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 opacity-40">
        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/20
                        flex items-center justify-center">
          <span className="text-2xl">🏢</span>
        </div>
        <p className="text-sm text-white/40">Select a layout to preview</p>
      </div>
    );
  }

  return (
    <Canvas
      shadows
      camera={{ position: [3, 2.5, 3.5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      className="w-full h-full"
    >
      <Suspense fallback={null}>
        <Scene layout={layout} />
      </Suspense>
    </Canvas>
  );
}
