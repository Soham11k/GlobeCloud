import { lazy, Suspense } from "react";
import type { GlobeScene3DProps } from "./GlobeScene3D";
import { useMotionPrefs } from "@/lib/useMotionPrefs";
import { SPACE_BG } from "./geo-tokens";
import { GlobeFallback2D } from "./GlobeFallback2D";

const GlobeScene3DInner = lazy(() =>
  import("./GlobeScene3D").then((m) => ({ default: m.GlobeScene3D }))
);

function SceneFallback({ className }: { className?: string }) {
  return (
    <div className={className} style={{ background: SPACE_BG }}>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 70% 50%, rgba(91,82,255,0.25), transparent 70%)",
        }}
      />
    </div>
  );
}

export function GlobeScene3DLazy(
  props: Omit<GlobeScene3DProps, "reducedMotion" | "mobile" | "enableBloom">
) {
  const { reducedMotion, mobile, enableBloom } = useMotionPrefs();

  if (reducedMotion) {
    return (
      <GlobeFallback2D
        className={props.className}
        regions={props.regions}
        probes={Object.entries(props.healthy ?? {}).map(([region_id, healthy]) => ({
          region_id,
          healthy,
          latency_ms: props.latencies?.[region_id],
        }))}
        client={props.client}
        selected={props.selectedRegion}
      />
    );
  }

  return (
    <Suspense fallback={<SceneFallback className={props.className} />}>
      <GlobeScene3DInner
        {...props}
        reducedMotion={reducedMotion}
        mobile={mobile}
        enableBloom={enableBloom}
      />
    </Suspense>
  );
}
