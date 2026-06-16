import {
  useProduct,
  useHealth,
  useMetrics,
  useSyncStatus,
  useActivity,
  useMetricsHistory,
  useMetricsSummary,
  useRegions,
} from "@/lib/hooks";
import { Panel, Kpi, DataTable, Chip, StatusLED } from "../components/ui";
import { LatencyAreaChart } from "@/components/charts/MetricSparkline";
import { ChartContainer } from "@/components/charts/ChartContainer";

export function OverviewPage() {
  const { data: product } = useProduct();
  const { data: health } = useHealth();
  const { data: metrics } = useMetrics();
  const { data: sync } = useSyncStatus();
  const { data: activity } = useActivity();
  const { data: history } = useMetricsHistory("latency_ms", 24);
  const { data: summary } = useMetricsSummary("latency_ms", 24);
  const { data: regions } = useRegions();

  const cache = metrics?.inference_cache;
  const hitPct = cache?.hit_rate != null ? Math.round(cache.hit_rate * 100) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Operations</h1>
        <p className="console-mono mt-1 text-[var(--gc-dim)]">
          {product?.name} v{product?.version ?? "1"} · {product?.tagline}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Regions healthy"
          value={`${metrics?.router.filter((r) => r.healthy).length ?? "—"}/${metrics?.router.length ?? "—"}`}
          sub={health?.replication_running ? "replication active" : "replication idle"}
        />
        <Kpi label="Sync cycles" value={sync?.cycles ?? "—"} sub={`interval ${sync?.interval_s ?? "—"}s`} />
        <Kpi
          label="Latency p50"
          value={summary?.summary.p50 != null ? `${Math.round(summary.summary.p50)}ms` : "—"}
          sub={`${summary?.summary.count ?? 0} samples / 24h`}
        />
        <Kpi
          label="Inference cache"
          value={hitPct != null ? `${hitPct}%` : "—"}
          sub={`${cache?.cache_hits ?? 0} hits · ${cache?.cache_misses ?? 0} misses`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Region probes">
          <DataTable
            headers={["region", "status", "latency", "circuit", "peer"]}
            empty="No probe data — server warming up"
            rows={(metrics?.router ?? []).map((r) => [
              <span key="id">{r.region_id}</span>,
              <span key="s" className="inline-flex items-center gap-2">
                <StatusLED status={r.healthy ? "ok" : "err"} />
                {r.healthy ? "healthy" : "down"}
              </span>,
              r.latency_ms != null ? `${r.latency_ms} ms` : "—",
              <Chip key="c" variant={r.circuit === "open" ? "err" : "default"}>{r.circuit ?? "—"}</Chip>,
              <span key="p" className="text-[var(--gc-dim)] truncate max-w-[120px] block">
                {r.peer_url ?? (r.is_local ? "local sqlite" : "—")}
              </span>,
            ])}
          />
        </Panel>

        <Panel title="Fleet registry" action={<Chip>{regions?.deployment_mode}</Chip>}>
          <DataTable
            headers={["id", "name", "base ms", "local", "peer url"]}
            rows={(regions?.regions ?? []).map((r) => [
              r.id,
              r.name,
              `${r.base_latency_ms}`,
              r.is_local ? "yes" : "no",
              <span key="u" className="text-[var(--gc-dim)] truncate max-w-[140px] block">
                {r.peer_url ?? "—"}
              </span>,
            ])}
          />
        </Panel>
      </div>

      <Panel title="Latency history (24h sampled)">
        <ChartContainer title="" description="">
          <LatencyAreaChart data={history?.points ?? []} />
        </ChartContainer>
      </Panel>

      <Panel title="Activity feed">
        <DataTable
          headers={["time", "type", "summary"]}
          empty="No activity recorded yet"
          rows={(activity?.items ?? []).slice(0, 12).map((item) => [
            new Date(item.ts).toLocaleTimeString(),
            item.type,
            item.summary,
          ])}
        />
      </Panel>

      {product?.features && (
        <p className="console-mono text-[10px] text-[var(--gc-dim)]">
          features: {product.features.join(" · ")}
        </p>
      )}
    </div>
  );
}
