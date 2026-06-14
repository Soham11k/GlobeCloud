import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";

function GlobeMesh() {
  return (
    <group>
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial color="#1e3a5f" roughness={0.7} metalness={0.2} />
      </Sphere>
      <mesh rotation={[0.5, 0.8, 0]}>
        <torusGeometry args={[1.35, 0.01, 8, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
      </mesh>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
    </group>
  );
}

export function Globe3D({ className }: { className?: string }) {
  return (
    <div className={className || "h-64 w-full"}>
      <Canvas camera={{ position: [0, 0, 2.8], fov: 45 }}>
        <GlobeMesh />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
