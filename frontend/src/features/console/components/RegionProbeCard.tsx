import { StatusDot } from "@/components/layout/StatusBadge";
import { Chip } from "./ui";
import { cn } from "@/lib/utils";

type Props = {
  regionId: string;
  healthy: boolean;
  latencyMs?: number | null;
  circuit?: string;
  peerUrl?: string | null;
  isLocal?: boolean;
};

export function RegionProbeCard({
  regionId,
  healthy,
  latencyMs,
  circuit,
  peerUrl,
  isLocal,
}: Props) {
  return (
    <div
      className={cn(
        "console-panel p-4 transition-colors",
        healthy ? "border-[var(--geo-healthy)]/20" : "border-[var(--geo-error)]/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{regionId}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot status={healthy ? "ok" : "err"} />
            {healthy ? "Healthy" : "Unreachable"}
            {isLocal && <span className="text-accent">· local</span>}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-lg font-semibold tabular-nums",
            healthy ? "text-[var(--geo-healthy)]" : "text-[var(--geo-error)]",
          )}
        >
          {latencyMs != null ? `${latencyMs}ms` : "—"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {circuit && (
          <Chip variant={circuit === "open" ? "err" : "default"}>{circuit}</Chip>
        )}
        {(peerUrl || isLocal) && (
          <span className="truncate text-xs text-muted-foreground">
            {peerUrl ?? "local peer"}
          </span>
        )}
      </div>
    </div>
  );
}
