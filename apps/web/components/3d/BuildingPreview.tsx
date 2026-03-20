/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - three-fiber runtime JSX types
"use client";

// JSX intrinsic element types for three-fiber are provided in ../types/three-fiber-jsx.d.ts

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  Suspense,
  useMemo,
} from "react";
import { Canvas, useFrame, useThree, type RootState, extend } from "@react-three/fiber";
import { OrbitControls, Text, Grid, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LayoutRecord } from "@/components/results/LayoutSelector";

// Import Three.js JSX types
import "@react-three/fiber";

// Extend Three.js objects for JSX usage
extend({ Group: THREE.Group, Mesh: THREE.Mesh, BoxGeometry: THREE.BoxGeometry, AmbientLight: THREE.AmbientLight, DirectionalLight: THREE.DirectionalLight, HemisphereLight: THREE.HemisphereLight, MeshStandardMaterial: THREE.MeshStandardMaterial });

// ─────────────────────────────────────────────────────────────
// Constants & types
// ─────────────────────────────────────────────────────────────

/** 1 Three.js unit = 1 metre. Conversion: ft → m */
const FT_TO_M = 0.3048;

/** Heights in metres */
const GROUND_FL_H = 4.5;
const UPPER_FL_H  = 3.0;

/** Plot ground plane padding in metres */
const PLOT_PAD = 6;

export type ViewPreset = "perspective" | "front" | "side" | "top";

interface FloorBlock {
  /** position centre */
  x: number; // metres from origin
  z: number;
  /** dimensions */
  w: number; // metres
  d: number;
  floorIndex: number; // 0 = ground
  isGround: boolean;
  use: "residential" | "parking" | "amenity" | "ground";
}

// ─────────────────────────────────────────────────────────────
// Geometry generator: reads geometry_hints OR floor_plan
// ─────────────────────────────────────────────────────────────

function generateFloorBlocks(layout: LayoutRecord): FloorBlock[] {
  const fp      = layout.floor_plan;
  const shape   = fp.footprint.shape.toLowerCase();
  const wM      = fp.footprint.width_ft * FT_TO_M;
  const dM      = fp.footprint.depth_ft * FT_TO_M;
  const floors  = fp.floors;

  /** Returns the 2D footprint extents for a given shape as [{x,z,w,d}] */
  function footprintSlices(): Array<{ x: number; z: number; w: number; d: number }> {
    switch (shape) {
      case "l-shaped":
      case "l_shaped":
        return [
          { x: 0,        z: dM / 4,   w: wM,      d: dM / 2 },
          { x: -wM / 4,  z: -dM / 4,  w: wM / 2,  d: dM / 2 },
        ];
      case "u-shaped":
      case "u_shaped":
        return [
          { x: 0,            z: dM / 3,    w: wM,        d: dM / 3 },
          { x: -wM * 0.35,   z: -dM / 6,   w: wM * 0.3,  d: dM * 0.6 },
          { x:  wM * 0.35,   z: -dM / 6,   w: wM * 0.3,  d: dM * 0.6 },
        ];
      case "courtyard":
        return [
          { x: 0,       z:  dM / 2,  w: wM,        d: dM * 0.15 },
          { x: 0,       z: -dM / 2,  w: wM,        d: dM * 0.15 },
          { x: -wM / 2, z: 0,        w: wM * 0.15, d: dM        },
          { x:  wM / 2, z: 0,        w: wM * 0.15, d: dM        },
        ];
      case "tower":
        return [{ x: 0, z: 0, w: wM * 0.55, d: dM * 0.55 }];
      case "y-shaped":
        return [
          { x: 0,       z: 0,       w: wM * 0.25, d: dM * 0.25 },
          { x: 0,       z: dM / 2,  w: wM * 0.18, d: dM / 2    },
          { x: -wM / 2, z: -dM / 4, w: wM / 2,    d: dM * 0.18 },
          { x:  wM / 2, z: -dM / 4, w: wM / 2,    d: dM * 0.18 },
        ];
      default: // rectangular
        return [{ x: 0, z: 0, w: wM, d: dM }];
    }
  }

  const slices = footprintSlices();
  const blocks: FloorBlock[] = [];

  for (let fl = 0; fl < floors; fl++) {
    const isGround = fl === 0;
    const use: FloorBlock["use"] = isGround ? "ground" : "residential";

    for (const s of slices) {
      blocks.push({
        x: s.x,
        z: s.z,
        w: s.w,
        d: s.d,
        floorIndex: fl,
        isGround,
        use,
      });
    }
  }

  return blocks;
}

/** Y-position (bottom) of a given floor index */
function floorBottomY(floorIndex: number): number {
  if (floorIndex === 0) return 0;
  return GROUND_FL_H + (floorIndex - 1) * UPPER_FL_H;
}

/** Height of a given floor */
function floorHeight(floorIndex: number): number {
  return floorIndex === 0 ? GROUND_FL_H : UPPER_FL_H;
}

// ─────────────────────────────────────────────────────────────
// Materials (memoised outside component to avoid re-creation)
// ─────────────────────────────────────────────────────────────

const MAT_GROUND = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#6b7280"),
  roughness: 0.7,
  metalness: 0.05,
});

const MAT_UPPER = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#f5f0e8"),
  roughness: 0.6,
  metalness: 0.08,
});

const MAT_GROUND_FADED = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#6b7280"),
  roughness: 0.7,
  metalness: 0.05,
  transparent: true,
  opacity: 0.18,
});

const MAT_UPPER_FADED = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#f5f0e8"),
  roughness: 0.6,
  metalness: 0.08,
  transparent: true,
  opacity: 0.18,
});

const MAT_WINDOW = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#a8c8f0"),
  roughness: 0.1,
  metalness: 0.6,
  transparent: true,
  opacity: 0.72,
  emissive: new THREE.Color("#6aaee8"),
  emissiveIntensity: 0.15,
});

const MAT_PARKING = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#374151"),
  roughness: 0.8,
  metalness: 0.1,
  transparent: true,
  opacity: 0.85,
});

const MAT_AMENITY = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#4ade80"),
  roughness: 0.5,
  metalness: 0.1,
  transparent: true,
  opacity: 0.85,
  emissive: new THREE.Color("#22c55e"),
  emissiveIntensity: 0.12,
});

// ─────────────────────────────────────────────────────────────
// WindowStrips: thin horizontal bands every ~3m on each face
// ─────────────────────────────────────────────────────────────

interface WindowStripsProps {
  w: number;
  h: number;
  d: number;
  cy: number; // centre Y of parent block
  visible: boolean;
}

function WindowStrips({ w, h, d, cy, visible }: WindowStripsProps) {
  if (!visible) return null;

  const flH   = h;
  // One window band per 3m stripe inside the block height
  const bands = Math.max(1, Math.floor(flH / 3));
  const bandH = 0.55;
  const gap   = flH / bands;

  return (
    <>
      {Array.from({ length: bands }).map((_, bi) => {
        const bandY = cy - h / 2 + gap * (bi + 0.5);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return (
          // @ts-expect-error - Three.js JSX elements are extended at runtime by @react-three/fiber
          <group key={bi} position={[0, bandY, 0]}>
            {/* Front face */}
            {/* @ts-expect-error - Three.js JSX elements */}
            <mesh position={[0, 0, d / 2 + 0.02]} castShadow={false}>
              {/* @ts-expect-error - Three.js JSX elements */}
              <boxGeometry args={[w * 0.78, bandH, 0.04]} />
              {/* @ts-expect-error - Three.js JSX elements */}
              <primitive object={MAT_WINDOW} attach="material" />
            </mesh>
            {/* Rear face */}
            {/* @ts-expect-error - Three.js JSX elements */}
            <mesh position={[0, 0, -(d / 2 + 0.02)]} castShadow={false}>
              {/* @ts-expect-error - Three.js JSX elements */}
              <boxGeometry args={[w * 0.78, bandH, 0.04]} />
              {/* @ts-expect-error - Three.js JSX elements */}
              <primitive object={MAT_WINDOW} attach="material" />
            </mesh>
            {/* Left face */}
            <mesh position={[-(w / 2 + 0.02), 0, 0]} castShadow={false}>
              <boxGeometry args={[0.04, bandH, d * 0.78]} />
              <primitive object={MAT_WINDOW} attach="material" />
            </mesh>
            {/* Right face */}
            <mesh position={[w / 2 + 0.02, 0, 0]} castShadow={false}>
              <boxGeometry args={[0.04, bandH, d * 0.78]} />
              <primitive object={MAT_WINDOW} attach="material" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Single floor block mesh
// ─────────────────────────────────────────────────────────────

interface FloorMeshProps {
  block: FloorBlock;
  visible: boolean;    // fully visible vs faded
  showWindows: boolean;
  showParking: boolean;
  showAmenities: boolean;
  showUnits: boolean;
}

function FloorMesh({
  block,
  visible,
  showWindows,
  showParking,
  showAmenities,
  showUnits,
}: FloorMeshProps) {
  const h   = floorHeight(block.floorIndex);
  const bot = floorBottomY(block.floorIndex);
  const cy  = bot + h / 2;

  // Determine material & visibility
  let mat: THREE.MeshStandardMaterial;
  let skipRender = false;

  if (block.use === "parking") {
    if (!showParking) skipRender = true;
    mat = visible ? MAT_PARKING : MAT_GROUND_FADED;
  } else if (block.use === "amenity") {
    if (!showAmenities) skipRender = true;
    mat = visible ? MAT_AMENITY : MAT_UPPER_FADED;
  } else if (block.use === "residential") {
    if (!showUnits) skipRender = true;
    mat = visible ? MAT_UPPER : MAT_UPPER_FADED;
  } else {
    // ground
    mat = visible ? MAT_GROUND : MAT_GROUND_FADED;
  }

  if (skipRender) return null;

  return (
    <group position={[block.x, 0, block.z]}>
      {/* Main solid */}
      <mesh position={[0, cy, 0]} castShadow receiveShadow>
        <boxGeometry args={[block.w, h, block.d]} />
        <primitive object={mat} attach="material" />
      </mesh>

      {/* Window strips (only on visible floors, residential/ground) */}
      {(block.use === "residential" || block.use === "ground") && (
        <WindowStrips
          w={block.w}
          h={h}
          d={block.d}
          cy={cy}
          visible={visible && showWindows}
        />
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Roof accent cap
// ─────────────────────────────────────────────────────────────

function RoofAccent({
  layout,
  totalH,
}: {
  layout: LayoutRecord;
  totalH: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const wM  = layout.floor_plan.footprint.width_ft * FT_TO_M;
  const dM  = layout.floor_plan.footprint.depth_ft * FT_TO_M;

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = totalH + 0.3 + Math.sin(clock.elapsedTime * 1.2) * 0.08;
    }
  });

  return (
    <mesh ref={ref} position={[0, totalH + 0.3, 0]} castShadow={false}>
      <boxGeometry args={[Math.min(wM * 0.6, 12), 0.4, Math.min(dM * 0.6, 12)]} />
      <meshStandardMaterial
        color="#7F77DD"
        emissive="#5c56b8"
        emissiveIntensity={1.8}
        roughness={0.2}
        metalness={0.4}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Ground plane (plot footprint)
// ─────────────────────────────────────────────────────────────

function PlotGround({ layout }: { layout: LayoutRecord }) {
  const wM = layout.floor_plan.footprint.width_ft * FT_TO_M + PLOT_PAD * 2;
  const dM = layout.floor_plan.footprint.depth_ft * FT_TO_M + PLOT_PAD * 2;
  return (
    <mesh position={[0, -0.05, 0]} receiveShadow>
      <boxGeometry args={[wM, 0.1, dM]} />
      <meshStandardMaterial color="#1a2030" roughness={0.9} metalness={0.0} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera controller (view presets + idle auto-rotate)
// ─────────────────────────────────────────────────────────────

interface CameraRigProps {
  preset: ViewPreset;
  onInteract: () => void;
  autoRotate: boolean;
  totalH: number;
  wM: number;
  dM: number;
}

function CameraRig({
  preset,
  onInteract,
  autoRotate,
  totalH,
  wM,
  dM,
}: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const prevPreset  = useRef<ViewPreset | null>(null);

  const camDist = Math.max(wM, dM, totalH) * 1.8 + 10;

  useEffect(() => {
    if (preset === prevPreset.current) return;
    prevPreset.current = preset;

    let pos: [number, number, number];
    switch (preset) {
      case "front":
        pos = [0, totalH / 2, camDist];
        break;
      case "side":
        pos = [camDist, totalH / 2, 0];
        break;
      case "top":
        pos = [0, camDist * 1.4, 0.01];
        break;
      default:
        pos = [camDist * 0.7, camDist * 0.55, camDist * 0.7];
    }

    camera.position.set(...pos);
    camera.lookAt(0, totalH / 2, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, totalH / 2, 0);
      controlsRef.current.update();
    }
  }, [preset, camera, totalH, camDist]);

  return (
    <OrbitControls
      ref={controlsRef}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
      enableZoom
      enablePan
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={8}
      maxDistance={camDist * 2.5}
      onStart={onInteract}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Full 3D scene
// ─────────────────────────────────────────────────────────────

interface SceneProps {
  layout: LayoutRecord;
  activeFloor: number; // 1-based; 0 = show all
  showWindows: boolean;
  showParking: boolean;
  showAmenities: boolean;
  showUnits: boolean;
  preset: ViewPreset;
  onInteract: () => void;
  autoRotate: boolean;
}

function Scene({
  layout,
  activeFloor,
  showWindows,
  showParking,
  showAmenities,
  showUnits,
  preset,
  onInteract,
  autoRotate,
}: SceneProps) {
  const blocks  = useMemo(() => generateFloorBlocks(layout), [layout]);
  const totalH  = useMemo(() => {
    const fl = layout.floor_plan.floors;
    return fl === 0 ? 0 : GROUND_FL_H + Math.max(0, fl - 1) * UPPER_FL_H;
  }, [layout]);

  const wM = layout.floor_plan.footprint.width_ft * FT_TO_M;
  const dM = layout.floor_plan.footprint.depth_ft * FT_TO_M;

  return (
    <>
      {/* ── Lighting ── */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <directionalLight position={[-15, 20, -15]} intensity={0.35} color="#a5b4fc" />
      <hemisphereLight args={["#c8d8f8", "#202840", 0.4]} />

      {/* Soft shadow quality */}
      <SoftShadows size={25} samples={16} focus={0.5} />

      {/* ── Environment ── */}
      <Environment preset="city" />

      {/* ── Plot ground ── */}
      <PlotGround layout={layout} />

      {/* ── Grid ── */}
      <Grid
        position={[0, 0, 0]}
        infiniteGrid
        cellSize={1}
        sectionSize={5}
        fadeDistance={80}
        cellColor="#2a3050"
        sectionColor="#3a4570"
        cellThickness={0.4}
        sectionThickness={0.8}
        fadeStrength={3}
      />

      {/* ── Building blocks ── */}
      {blocks.map((block, i) => {
        const floorNum = block.floorIndex + 1; // 1-based
        return (
          <FloorMesh
            key={i}
            block={block}
            visible={activeFloor === 0 || floorNum === activeFloor}
            showWindows={showWindows}
            showParking={showParking}
            showAmenities={showAmenities}
            showUnits={showUnits}
          />
        );
      })}

      {/* ── Roof accent ── */}
      <RoofAccent layout={layout} totalH={totalH} />

      {/* ── Floor label ── */}
      <Text
        position={[0, totalH + 1.4, 0]}
        fontSize={1.2}
        color="#e8ecf4"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="#0d0f14"
        fillOpacity={0.85}
      >
        {layout.floor_plan.floors}F · {layout.concept_name}
      </Text>

      {/* ── Camera ── */}
      <CameraRig
        preset={preset}
        onInteract={onInteract}
        autoRotate={autoRotate}
        totalH={totalH}
        wM={wM}
        dM={dM}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Controls panel below canvas
// ─────────────────────────────────────────────────────────────

const VIEW_BUTTONS: { label: string; value: ViewPreset; icon: string }[] = [
  { label: "Perspective", value: "perspective", icon: "⬡" },
  { label: "Front",       value: "front",       icon: "▢" },
  { label: "Side",        value: "side",        icon: "▷" },
  { label: "Top",         value: "top",         icon: "◈" },
];

interface ControlsProps {
  totalFloors: number;
  activeFloor: number;
  onFloorChange: (f: number) => void;
  showParking: boolean;
  showAmenities: boolean;
  showUnits: boolean;
  showWindows: boolean;
  onToggle: (key: "parking" | "amenities" | "units" | "windows") => void;
  preset: ViewPreset;
  onPreset: (p: ViewPreset) => void;
}

function ControlsPanel({
  totalFloors,
  activeFloor,
  onFloorChange,
  showParking,
  showAmenities,
  showUnits,
  showWindows,
  onToggle,
  preset,
  onPreset,
}: ControlsProps) {
  const checkboxes: {
    key: "parking" | "amenities" | "units" | "windows";
    label: string;
    active: boolean;
    color: string;
  }[] = [
    { key: "units",     label: "Units",     active: showUnits,     color: "#7F77DD" },
    { key: "parking",   label: "Parking",   active: showParking,   color: "#6b7280" },
    { key: "amenities", label: "Amenities", active: showAmenities, color: "#4ade80" },
    { key: "windows",   label: "Windows",   active: showWindows,   color: "#a8c8f0" },
  ];

  return (
    <div className="px-3 py-3 space-y-3 border-t border-white/8 bg-[#0d0f14]/80 backdrop-blur-sm">
      {/* Floor slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
            Floor
          </span>
          <span className="text-[11px] font-bold text-white/80 tabular-nums">
            {activeFloor === 0 ? "All" : `${activeFloor} / ${totalFloors}`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={totalFloors}
          value={activeFloor}
          onChange={(e) => onFloorChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #7F77DD ${
              (activeFloor / totalFloors) * 100
            }%, #252a3a ${(activeFloor / totalFloors) * 100}%)`,
          }}
        />
        <div className="flex justify-between text-[9px] text-white/20">
          <span>All</span>
          <span>G</span>
          {Array.from({ length: Math.min(totalFloors - 1, 8) }, (_, i) => {
            const fl = Math.round(((i + 1) / Math.min(totalFloors - 1, 8)) * (totalFloors - 1));
            return <span key={fl}>{fl}</span>;
          })}
          <span>{totalFloors}</span>
        </div>
      </div>

      {/* Layer toggles + View buttons row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Checkboxes */}
        <div className="flex items-center gap-2 flex-wrap">
          {checkboxes.map(({ key, label, active, color }) => (
            <button
              key={key}
              id={`toggle-${key}`}
              onClick={() => onToggle(key)}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg
                         border transition-all duration-150 select-none"
              style={{
                borderColor: active ? color + "50" : "rgba(255,255,255,0.08)",
                background:  active ? color + "18" : "rgba(255,255,255,0.03)",
                color:       active ? color        : "rgba(255,255,255,0.35)",
              }}
            >
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0 transition-all"
                style={{ background: active ? color : "rgba(255,255,255,0.15)" }}
              />
              {label}
            </button>
          ))}
        </div>

        {/* View preset buttons */}
        <div className="flex items-center gap-1">
          {VIEW_BUTTONS.map(({ label, value, icon }) => (
            <button
              key={value}
              id={`view-${value}`}
              onClick={() => onPreset(value)}
              title={label}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm
                         border transition-all duration-150"
              style={{
                borderColor: preset === value ? "#7F77DD50"              : "rgba(255,255,255,0.08)",
                background:  preset === value ? "rgba(127,119,221,0.18)" : "rgba(255,255,255,0.03)",
                color:       preset === value ? "#a5b4fc"                : "rgba(255,255,255,0.35)",
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Loading skeleton inside Canvas
// ─────────────────────────────────────────────────────────────

function CanvasFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 opacity-60">
        <div className="w-10 h-10 border-2 border-[#7F77DD]/50 border-t-[#7F77DD] rounded-full animate-spin" />
        <p className="text-xs text-white/40">Building model…</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Exported component
// ─────────────────────────────────────────────────────────────

export interface BuildingPreviewProps {
  layout: LayoutRecord | null;
  className?: string;
}

const IDLE_TIMEOUT_MS = 4_000;

export function BuildingPreview({ layout, className = "" }: BuildingPreviewProps) {
  const [activeFloor,   setActiveFloor]   = useState(0);  // 0 = all
  const [showParking,   setShowParking]   = useState(true);
  const [showAmenities, setShowAmenities] = useState(true);
  const [showUnits,     setShowUnits]     = useState(true);
  const [showWindows,   setShowWindows]   = useState(true);
  const [preset,        setPreset]        = useState<ViewPreset>("perspective");
  const [autoRotate,    setAutoRotate]    = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset floor slider when layout changes
  useEffect(() => {
    setActiveFloor(0);
    setPreset("perspective");
    setAutoRotate(true);
  }, [layout?.id]);

  const handleInteract = useCallback(() => {
    setAutoRotate(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAutoRotate(true), IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const handleToggle = useCallback(
    (key: "parking" | "amenities" | "units" | "windows") => {
      if (key === "parking")   setShowParking(v => !v);
      if (key === "amenities") setShowAmenities(v => !v);
      if (key === "units")     setShowUnits(v => !v);
      if (key === "windows")   setShowWindows(v => !v);
    },
    [],
  );

  if (!layout) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl
                    border border-dashed border-white/10 bg-white/1.5 ${className}`}
      >
        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/15
                        flex items-center justify-center">
          <span className="text-3xl">🏢</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white/40">No layout selected</p>
          <p className="text-xs text-white/20 mt-0.5">Select a layout to preview in 3D</p>
        </div>
      </div>
    );
  }

  const totalFloors = layout.floor_plan.floors;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={layout.id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        className={`flex flex-col rounded-2xl border border-white/8 overflow-hidden
                    bg-[#0d0f14] ${className}`}
      >
        {/* Canvas area */}
        <div className="relative flex-1 min-h-0">
          <CanvasFallback />
          <Canvas
            shadows
            camera={{ position: [40, 30, 40], fov: 40 }}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            style={{ width: "100%", height: "100%" }}
            className="relative z-10"
            onCreated={({ scene }: RootState) => {
              scene.background = new THREE.Color("#0d0f14");
              scene.fog = new THREE.Fog("#0d0f14", 80, 250);
            }}
          >
            <Suspense fallback={null}>
              <Scene
                layout={layout}
                activeFloor={activeFloor}
                showWindows={showWindows}
                showParking={showParking}
                showAmenities={showAmenities}
                showUnits={showUnits}
                preset={preset}
                onInteract={handleInteract}
                autoRotate={autoRotate}
              />
            </Suspense>
          </Canvas>

          {/* Auto-rotate badge */}
          <div
            className="absolute top-2 right-2 z-20 pointer-events-none
                       flex items-center gap-1 text-[10px] px-2 py-1 rounded-full
                       border border-white/10 bg-black/40 backdrop-blur-sm"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: autoRotate ? "#4ade80" : "#6b7280" }}
            />
            <span className="text-white/40">{autoRotate ? "Rotating" : "Paused"}</span>
          </div>
        </div>

        {/* Controls panel */}
        <ControlsPanel
          totalFloors={totalFloors}
          activeFloor={activeFloor}
          onFloorChange={setActiveFloor}
          showParking={showParking}
          showAmenities={showAmenities}
          showUnits={showUnits}
          showWindows={showWindows}
          onToggle={handleToggle}
          preset={preset}
          onPreset={(p) => {
            setPreset(p);
            handleInteract();
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default BuildingPreview;
