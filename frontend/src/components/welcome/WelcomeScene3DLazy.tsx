import { lazy, Suspense } from "react";
import type { WelcomeScene3DProps } from "./WelcomeScene3D";
import { useMotionPrefs } from "@/lib/useMotionPrefs";

const WelcomeScene3DInner = lazy(() =>
  import("./WelcomeScene3D").then((m) => ({ default: m.WelcomeScene3D }))
);

function SceneFallback() {
  return (
    <div className="h-full w-full bg-[#03030A]">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 70% 50%, rgba(91,82,255,0.25), transparent 70%)",
        }}
      />
    </div>
  );
}

/** Static SVG fallback when WebGL is unavailable or reduced motion preferred without lazy load */
export function WelcomeSceneStatic({ className }: { className?: string }) {
  return (
    <div className={className} style={{ pointerEvents: "none", background: "#03030A" }}>
      <svg viewBox="0 0 800 600" className="h-full w-full opacity-40" aria-hidden>
        <circle cx="560" cy="300" r="140" fill="none" stroke="#5B52FF" strokeWidth="0.8" opacity="0.35" />
        <ellipse cx="560" cy="300" rx="140" ry="45" fill="none" stroke="#5B52FF" strokeWidth="0.5" opacity="0.2" />
        <circle cx="620" cy="240" r="6" fill="#2DD4A0" />
        <circle cx="500" cy="320" r="5" fill="#2DD4A0" />
        <circle cx="580" cy="360" r="5" fill="#F0A84A" />
      </svg>
    </div>
  );
}

export function WelcomeScene3DLazy(
  props: Omit<WelcomeScene3DProps, "reducedMotion" | "mobile" | "enableBloom">
) {
  const { reducedMotion, mobile, enableBloom } = useMotionPrefs();

  return (
    <Suspense fallback={<SceneFallback />}>
      <WelcomeScene3DInner
        {...props}
        reducedMotion={reducedMotion}
        mobile={mobile}
        enableBloom={enableBloom}
      />
    </Suspense>
  );
}
