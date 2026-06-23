import { cn } from "@/lib/utils";
import { GlobeScene3DLazy } from "./GlobeScene3DLazy";
import { GlobeFallback2D } from "./GlobeFallback2D";
import type { RegionInfo } from "@/lib/api";

type Probe = { region_id: string; healthy: boolean; latency_ms?: number | null };

type Props = {
  className?: string;
  regions?: RegionInfo[];
  latencies?: Record<string, number>;
  healthy?: Record<string, boolean>;
  height?: string;
  variant?: "hero" | "panel" | "ambient";
  showMapInset?: boolean;
  client?: { lat: number; lon: number };
  selected?: string;
  showArc?: boolean;
  interactive?: boolean;
};

/** 3D earth + optional real topo map inset — use on every geo surface. */
export function GeoVizPanel({
  className,
  regions,
  latencies = {},
  healthy = {},
  variant = "panel",
  height = "16rem",
  showMapInset = true,
  client,
  selected,
  showArc,
  interactive,
}: Props) {
  const probes: Probe[] = (regions ?? []).map((r) => ({
    region_id: r.id,
    healthy: healthy[r.id] ?? true,
    latency_ms: latencies[r.id],
  }));

  return (
    <div
      className={cn("geo-viz-panel relative overflow-hidden", className)}
      style={{ minHeight: height }}
    >
      <GlobeScene3DLazy
        className="absolute inset-0 h-full w-full"
        regions={regions}
        latencies={latencies}
        healthy={healthy}
        variant={variant}
        client={client}
        selectedRegion={selected}
      />

      {showMapInset && variant !== "hero" && (
        <div className="absolute bottom-2 right-2 z-10 w-[min(48%,220px)] overflow-hidden border border-border bg-background">
          <div className="border-b border-border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            LIVE MAP
          </div>
          <GlobeFallback2D
            className="h-[88px] w-full"
            regions={regions}
            probes={probes}
            client={client}
            selected={selected}
            showArc={showArc}
          />
        </div>
      )}

      {interactive && (
        <GlobeFallback2D
          className="absolute inset-0 z-20 h-full w-full opacity-0"
          regions={regions}
          probes={probes}
          client={client}
          selected={selected}
          showArc={showArc}
        />
      )}
    </div>
  );
}
