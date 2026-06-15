import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth, useMetrics, useProduct, useSyncStatus } from "@/lib/hooks";

/** Live overview snippet — same data as /app Overview panel */
export function ConsolePreview() {
  const { data: health, isLoading: hLoad } = useHealth();
  const { data: metrics, isLoading: mLoad } = useMetrics();
  const { data: product } = useProduct();
  const { data: sync } = useSyncStatus();

  const loading = hLoad || mLoad;
  const healthy = metrics?.router.filter((r) => r.healthy).length ?? 0;
  const total = metrics?.router.length ?? 0;
  const cacheHit =
    metrics?.inference_cache?.hit_rate != null
      ? `${Math.round(metrics.inference_cache.hit_rate * 100)}%`
      : "—";

  return (
    <div className="p-4 text-sm space-y-3 min-h-[280px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Overview</span>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {hLoad ? (
            <Skeleton className="h-5 w-14" />
          ) : (
            <Badge variant={health?.status === "ok" ? "success" : "danger"}>
              {health?.status === "ok" ? "online" : "degraded"}
            </Badge>
          )}
          {product && <Badge>{product.llm_mode}</Badge>}
        </div>
      </div>

      {product?.is_simulated && (
        <p className="text-[11px] text-muted-foreground border border-border rounded-md px-2 py-1.5">
          {product.simulation_note}
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Regions", value: loading ? "—" : String(total || "—") },
          { label: "Healthy", value: loading ? "—" : total ? `${healthy}/${total}` : "—" },
          { label: "Sync", value: sync?.cycles ?? "—" },
          { label: "Cache", value: cacheHit },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border p-2 bg-card">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            {loading && label !== "Sync" ? (
              <Skeleton className="h-5 w-8 mt-1" />
            ) : (
              <p className="font-semibold text-base mt-0.5 tabular-nums">{value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Region health</p>
        {loading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)
        ) : metrics?.router.length ? (
          metrics.router.map((r) => (
            <div key={r.region_id} className="flex justify-between text-xs py-1 border-b border-border/50 last:border-0">
              <span className="font-mono">{r.region_id}</span>
              <span className={r.healthy ? "text-muted-foreground tabular-nums" : "text-danger"}>
                {r.healthy ? `${r.latency_ms ?? "—"} ms` : "down"}
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No probes yet — server starting up.</p>
        )}
      </div>
    </div>
  );
}
