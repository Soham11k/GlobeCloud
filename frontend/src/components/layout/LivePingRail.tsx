import { useLiveMetrics } from "@/lib/hooks";
import { DotLabel } from "@/components/brand/DotLabel";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function LivePingRail({ className, compact }: Props) {
  const { data: metrics } = useLiveMetrics();
  const router = metrics?.router ?? [];

  if (!router.length) return null;

  return (
    <div className={cn("flex items-center gap-4 overflow-x-auto text-xs text-muted-foreground", className)}>
      {!compact && <DotLabel dot={false} className="shrink-0 tracking-[0.2em]">Probes</DotLabel>}
      {router.map((r, i) => (
        <span key={r.region_id} className="shrink-0 tabular-nums">
          {i > 0 && <span className="mr-4 text-border">|</span>}
          <span className={r.healthy ? "text-foreground" : "text-accent"}>
            {r.region_id}
          </span>
          <span className="ml-1 font-mono">{r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : "—"}</span>
        </span>
      ))}
    </div>
  );
}
