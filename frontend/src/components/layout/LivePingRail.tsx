import { useLiveMetrics } from "@/lib/hooks";
import { StatusDot } from "@/components/layout/StatusBadge";
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
        "flex items-center gap-4 overflow-x-auto font-mono text-[11px]",
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <StatusDot status={router.every((r) => r.healthy) ? "ok" : "warn"} />
        {!compact && "probes"}
      </span>
      {router.map((r) => (
        <span
          key={r.region_id}
          className="shrink-0 tabular-nums"
          title={[r.probe_mode, r.peer_url].filter(Boolean).join(" · ") || undefined}
        >
          <span className={r.healthy ? "text-[var(--geo-healthy)]" : "text-[var(--geo-error)]"}>
            {r.region_id}
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
