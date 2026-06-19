import { useLiveMetrics } from "@/lib/hooks";
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
    <div
      className={cn(
        "flex items-center gap-3 overflow-x-auto font-mono text-[11px] tracking-tight",
        className
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        {!compact && "PING"}
      </span>
      {router.map((r) => (
        <span
          key={`${r.region_id}-${r.latency_ms}`}
          className="shrink-0 tabular-nums transition-opacity duration-300"
        >
          <span className={r.healthy ? "text-success" : "text-danger"}>
            {r.region_id.replace(/-(east|west|south|north|central)-\d+$/, "").replace(/-/g, "") || r.region_id}
          </span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-foreground">
            {r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : "—"}
          </span>
        </span>
      ))}
    </div>
  );
}
