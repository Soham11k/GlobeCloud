import { GlobeMap } from "@/components/GlobeMap";
import type { RegionInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SPACE_BG } from "./geo-tokens";

type Props = {
  className?: string;
  regions?: RegionInfo[];
  probes?: { region_id: string; healthy: boolean }[];
  selected?: string;
  client?: { lat: number; lon: number };
  showArc?: boolean;
};

export function WelcomeSceneStatic({ className }: { className?: string }) {
  return (
    <div className={className} style={{ pointerEvents: "none", background: SPACE_BG }}>
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

export function GlobeFallback2D({
  className,
  regions,
  probes,
  selected,
  client,
  showArc,
}: Props) {
  return (
    <div className={cn("relative", className)} style={{ background: SPACE_BG }}>
      <GlobeMap
        regions={regions}
        probes={probes}
        selected={selected}
        client={client}
        showArc={showArc}
        className="h-full w-full opacity-90"
      />
    </div>
  );
}
