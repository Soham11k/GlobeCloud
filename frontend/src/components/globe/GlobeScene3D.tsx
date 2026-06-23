import { useMemo, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Html, Line } from "@react-three/drei";
import {
  QuadraticBezierCurve3,
  Vector3,
  Group,
  Mesh,
  DoubleSide,
} from "three";
import type { RegionInfo } from "@/lib/api";
import { arcControlPoint, latLonToVector3 } from "@/lib/geo3d";
import {
  ARC_PAIRS,
  GEO_ACCENT,
  SPACE_BG,
  markerColor,
  variantAnimateCamera,
  variantCamera,
  variantGlobeRotate,
  variantGlobeScale,
  variantLookAt,
  type GlobeVariant,
} from "./geo-tokens";

function CameraRig({
  animate,
  lookAt,
  basePosition,
}: {
  animate: boolean;
  lookAt: [number, number, number];
  basePosition: [number, number, number];
}) {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const ox = animate ? Math.sin(t * 0.2) * 0.06 : 0;
    const oy = animate ? Math.sin(t * 0.15) * 0.03 : 0;
    camera.position.set(basePosition[0] + ox, basePosition[1] + oy, basePosition[2]);
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
  });
  return null;
}

function EarthGlobe({ animate, scale = 1 }: { animate: boolean; scale?: number }) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (animate && ref.current) ref.current.rotation.y += delta * 0.05;
  });

  return (
    <group ref={ref} rotation={[0.12, 0, 0]} scale={scale}>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#000000" wireframe />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.002, 24, 24]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function ClientMarker({ lat, lon }: { lat: number; lon: number }) {
  const position = useMemo(() => latLonToVector3(lat, lon, 1.04), [lat, lon]);
  return (
    <group position={position}>
      <mesh>
        <ringGeometry args={[0.05, 0.065, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.032, 12, 12]} />
        <meshBasicMaterial color="#ffffff" wireframe />
      </mesh>
    </group>
  );
}

function RegionMarker({
  region,
  position,
  color,
  latency,
  animate,
  showLabels,
  selected,
}: {
  region: RegionInfo;
  position: Vector3;
  color: string;
  latency?: number;
  animate: boolean;
  showLabels: boolean;
  selected?: boolean;
}) {
  const ringRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (!animate || !ringRef.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 2 + position.x) * 0.15;
    ringRef.current.scale.setScalar(s);
  });

  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.04, 0.055, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[selected ? 0.038 : 0.028, 16, 16]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {showLabels && (
        <Html
          position={[0, 0.09, 0]}
          center
          distanceFactor={4}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            color: "rgba(255,255,255,0.45)",
            textAlign: "center",
          }}
        >
          <div>{region.id}</div>
          {latency != null && (
            <div style={{ color, fontWeight: 600, fontSize: "10px" }}>{Math.round(latency)}ms</div>
          )}
        </Html>
      )}
    </group>
  );
}

function RegionMarkers({
  regions,
  latencies,
  healthy,
  animate,
  showLabels,
  selectedRegion,
}: {
  regions: RegionInfo[];
  latencies: Record<string, number>;
  healthy: Record<string, boolean>;
  animate: boolean;
  showLabels: boolean;
  selectedRegion?: string;
}) {
  const positions = useMemo(
    () => regions.map((r) => latLonToVector3(r.latitude, r.longitude, 1.02)),
    [regions]
  );

  return (
    <group>
      {regions.map((region, i) => (
        <RegionMarker
          key={`${region.id}-${latencies[region.id] ?? "x"}-${healthy[region.id]}`}
          region={region}
          position={positions[i]}
          color={markerColor(region.id, latencies[region.id], healthy[region.id] ?? true)}
          latency={latencies[region.id]}
          animate={animate}
          showLabels={showLabels}
          selected={region.id === selectedRegion}
        />
      ))}
    </group>
  );
}

function AnimatedArc({
  start,
  end,
  color,
  animate,
}: {
  start: Vector3;
  end: Vector3;
  color: string;
  animate: boolean;
}) {
  const dotRef = useRef<Mesh>(null);
  const curve = useMemo(() => {
    const ctrl = arcControlPoint(start, end, 0.4);
    return new QuadraticBezierCurve3(start.clone(), ctrl, end.clone());
  }, [start, end]);

  const linePoints = useMemo(() => curve.getPoints(64), [curve]);

  useFrame((state) => {
    if (!animate || !dotRef.current) return;
    const t = (state.clock.elapsedTime * 0.25) % 1;
    const p = curve.getPoint(t);
    dotRef.current.position.copy(p);
  });

  return (
    <group>
      <Line points={linePoints} color={color} lineWidth={1} transparent opacity={0.35} />
      {animate && (
        <mesh ref={dotRef}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

function RegionArcs({ regions, animate }: { regions: RegionInfo[]; animate: boolean }) {
  const positions = useMemo(
    () => regions.map((r) => latLonToVector3(r.latitude, r.longitude, 1.02)),
    [regions]
  );

  if (positions.length < 2) return null;

  return (
    <group>
      {ARC_PAIRS.filter(([a, b]) => a < positions.length && b < positions.length).map(([a, b]) => (
        <AnimatedArc
          key={`${a}-${b}`}
          start={positions[a]}
          end={positions[b]}
          color={GEO_ACCENT}
          animate={animate}
        />
      ))}
    </group>
  );
}

function SceneEffects() {
  return null;
}

function SceneContent({
  regions,
  latencies,
  healthy,
  variant,
  reducedMotion,
  client,
  selectedRegion,
}: {
  regions: RegionInfo[];
  latencies: Record<string, number>;
  healthy: Record<string, boolean>;
  variant: GlobeVariant;
  reducedMotion: boolean;
  client?: { lat: number; lon: number };
  selectedRegion?: string;
}) {
  const animateGlobe = variantGlobeRotate(variant, reducedMotion);
  const animateCamera = variantAnimateCamera() && !reducedMotion;
  const animateArcs = !reducedMotion;
  const starCount = 0;
  const globeScale = variantGlobeScale(variant);
  const lookAt = variantLookAt(variant);
  const cam = variantCamera(variant);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!animateGlobe) invalidate();
  }, [animateGlobe, invalidate]);

  return (
    <>
      <color attach="background" args={[SPACE_BG]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 2, 4]} intensity={0.5} color="#ffffff" />

      {starCount > 0 && (
        <Stars radius={80} depth={50} count={starCount} factor={2.5} saturation={0} fade speed={animateGlobe ? 0.3 : 0} />
      )}

      <Suspense fallback={null}>
        <EarthGlobe animate={animateGlobe} scale={globeScale} />
      </Suspense>
      <RegionMarkers
        regions={regions}
        latencies={latencies}
        healthy={healthy}
        animate={animateArcs}
        showLabels={variant !== "ambient"}
        selectedRegion={selectedRegion}
      />
      {client && <ClientMarker lat={client.lat} lon={client.lon} />}
      <RegionArcs regions={regions} animate={animateArcs} />
      <CameraRig animate={animateCamera} lookAt={lookAt} basePosition={cam.position} />
      <SceneEffects />
    </>
  );
}

export const DEFAULT_REGIONS: RegionInfo[] = [
  { id: "us-east-1", name: "US East", latitude: 37.43, longitude: -78.66, base_latency_ms: 12, is_local: true },
  { id: "eu-west-1", name: "EU West", latitude: 53.35, longitude: -6.26, base_latency_ms: 18, is_local: false },
  { id: "ap-south-1", name: "AP South", latitude: 19.08, longitude: 72.88, base_latency_ms: 24, is_local: false },
];

export type GlobeScene3DProps = {
  className?: string;
  regions?: RegionInfo[];
  latencies?: Record<string, number>;
  healthy?: Record<string, boolean>;
  reducedMotion?: boolean;
  mobile?: boolean;
  enableBloom?: boolean;
  variant?: GlobeVariant;
  interactive?: boolean;
  client?: { lat: number; lon: number };
  selectedRegion?: string;
};

export function GlobeScene3D({
  className,
  regions = DEFAULT_REGIONS,
  latencies = {},
  healthy = {},
  reducedMotion = false,
  mobile = false,
  variant = "hero",
  interactive = false,
  client,
  selectedRegion,
}: GlobeScene3DProps) {
  const animate = !reducedMotion;
  const cam = variantCamera(variant);

  return (
    <div className={className} style={{ pointerEvents: interactive ? "auto" : "none" }}>
      <Canvas
        camera={{ position: cam.position, fov: cam.fov }}
        dpr={mobile ? [1, 1] : [1, 1.25]}
        frameloop={animate && variant === "hero" ? "always" : "demand"}
        gl={{ antialias: true, alpha: variant === "ambient", powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <SceneContent
          regions={regions.length ? regions : DEFAULT_REGIONS}
          latencies={latencies}
          healthy={healthy}
          variant={variant}
          reducedMotion={reducedMotion}
          client={client}
          selectedRegion={selectedRegion}
        />
      </Canvas>
    </div>
  );
}
