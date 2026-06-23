import { cn } from "@/lib/utils";
import { GeoVizPanel } from "./GeoVizPanel";
import type { RegionInfo } from "@/lib/api";
import type { GlobeVariant } from "./geo-tokens";

type Props = {
  className?: string;
  regions?: RegionInfo[];
  latencies?: Record<string, number>;
  healthy?: Record<string, boolean>;
  variant?: GlobeVariant;
  height?: string;
  showMapInset?: boolean;
  client?: { lat: number; lon: number };
  selected?: string;
  showArc?: boolean;
  interactive?: boolean;
};

export function GlobeScenePanel({
  className,
  regions,
  latencies,
  healthy,
  variant = "panel",
  height = "16rem",
  showMapInset = true,
  client,
  selected,
  showArc,
  interactive,
}: Props) {
  return (
    <GeoVizPanel
      className={cn(className)}
      regions={regions}
      latencies={latencies}
      healthy={healthy}
      variant={variant}
      height={height}
      showMapInset={showMapInset && variant !== "hero"}
      client={client}
      selected={selected}
      showArc={showArc}
      interactive={interactive}
    />
  );
}
