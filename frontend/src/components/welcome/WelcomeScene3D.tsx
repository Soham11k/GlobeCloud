import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Html, Line } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import {
  QuadraticBezierCurve3,
  Vector3,
  Group,
  Mesh,
  Color,
  DoubleSide,
} from "three";
import type { RegionInfo } from "@/lib/api";
import { arcControlPoint, latLonToVector3, sampleLandLatLon } from "@/lib/geo3d";

const ARC_PAIRS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 0],
];

function markerColor(_regionId: string, latency?: number, healthy = true): string {
  if (!healthy) return "#f87171";
  if (latency != null && latency > 80) return "#F0A84A";
  return "#2DD4A0";
}

function CameraRig({ animate }: { animate: boolean }) {
  const { camera } = useThree();
  useFrame((state) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.2) * 0.08;
    camera.position.y = Math.sin(t * 0.15) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function LandDots() {
  const points = useMemo(() => {
    return sampleLandLatLon(360).map(([lon, lat]) => latLonToVector3(lat, lon, 1.002));
  }, []);
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.004, 4, 4]} />
          <meshBasicMaterial color="#475569" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function WelcomeGlobe({ animate }: { animate: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (animate && ref.current) ref.current.rotation.y += delta * 0.15;
  });
  return (
    <group ref={ref}>
      <LandDots />
      <mesh>
        <icosahedronGeometry args={[1, 3]} />
        <meshBasicMaterial color="#5B52FF" wireframe transparent opacity={0.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.99, 48, 48]} />
        <meshBasicMaterial color="#08061a" transparent opacity={0.92} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.001, 32, 32]} />
        <meshBasicMaterial color="#5B52FF" wireframe transparent opacity={0.08} />
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
}: {
  region: RegionInfo;
  position: Vector3;
  color: string;
  latency?: number;
  animate: boolean;
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
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight color={color} intensity={0.8} distance={0.5} />
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
    </group>
  );
}

function RegionMarkers({
  regions,
  latencies,
  healthy,
  animate,
}: {
  regions: RegionInfo[];
  latencies: Record<string, number>;
  healthy: Record<string, boolean>;
  animate: boolean;
}) {
  const positions = useMemo(
    () => regions.map((r) => latLonToVector3(r.latitude, r.longitude, 1.02)),
    [regions]
  );

  return (
    <group>
      {regions.map((region, i) => (
        <RegionMarker
          key={region.id}
          region={region}
          position={positions[i]}
          color={markerColor(region.id, latencies[region.id], healthy[region.id] ?? true)}
          latency={latencies[region.id]}
          animate={animate}
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

function RegionArcs({
  regions,
  animate,
}: {
  regions: RegionInfo[];
  animate: boolean;
}) {
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
          color={new Color("#5B52FF").lerp(new Color("#2DD4A0"), 0.3).getStyle()}
          animate={animate}
        />
      ))}
    </group>
  );
}

function SceneEffects({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.2} mipmapBlur />
    </EffectComposer>
  );
}

function WelcomeSceneContent({
  regions,
  latencies,
  healthy,
  animate,
  starCount,
  enableBloom,
}: {
  regions: RegionInfo[];
  latencies: Record<string, number>;
  healthy: Record<string, boolean>;
  animate: boolean;
  starCount: number;
  enableBloom: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!animate) invalidate();
  }, [animate, invalidate]);

  return (
    <>
      <color attach="background" args={["#03030A"]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[4, 2, 4]} intensity={1.2} color="#5B52FF" />
      <pointLight position={[-3, -2, 2]} intensity={0.4} color="#2DD4A0" />

      {starCount > 0 && (
        <Stars radius={80} depth={50} count={starCount} factor={3} saturation={0} fade speed={animate ? 0.4 : 0} />
      )}

      <WelcomeGlobe animate={animate} />
      <RegionMarkers regions={regions} latencies={latencies} healthy={healthy} animate={animate} />
      <RegionArcs regions={regions} animate={animate} />
      <CameraRig animate={animate} />
      <SceneEffects enabled={enableBloom} />
    </>
  );
}

const DEFAULT_REGIONS: RegionInfo[] = [
  { id: "us-east-1", name: "US East", latitude: 37.43, longitude: -78.66, base_latency_ms: 12, is_local: true },
  { id: "eu-west-1", name: "EU West", latitude: 53.35, longitude: -6.26, base_latency_ms: 18, is_local: false },
  { id: "ap-south-1", name: "AP South", latitude: 19.08, longitude: 72.88, base_latency_ms: 24, is_local: false },
];

export type WelcomeScene3DProps = {
  className?: string;
  regions?: RegionInfo[];
  latencies?: Record<string, number>;
  healthy?: Record<string, boolean>;
  reducedMotion?: boolean;
  mobile?: boolean;
  enableBloom?: boolean;
};

export function WelcomeScene3D({
  className,
  regions = DEFAULT_REGIONS,
  latencies = {},
  healthy = {},
  reducedMotion = false,
  mobile = false,
  enableBloom = true,
}: WelcomeScene3DProps) {
  const animate = !reducedMotion;
  const starCount = reducedMotion ? 0 : mobile ? 800 : 3000;

  return (
    <div className={className} style={{ pointerEvents: "none" }}>
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 50 }}
        dpr={[1, 1.5]}
        frameloop={animate ? "always" : "demand"}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <WelcomeSceneContent
          regions={regions.length ? regions : DEFAULT_REGIONS}
          latencies={latencies}
          healthy={healthy}
          animate={animate}
          starCount={starCount}
          enableBloom={enableBloom && !mobile}
        />
      </Canvas>
    </div>
  );
}
