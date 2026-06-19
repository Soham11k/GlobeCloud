import {
  useProduct,
  useHealth,
  useLiveMetrics,
  useSyncStatus,
  useActivity,
  useMetricsHistory,
  useMetricsSummary,
  useRegions,
} from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiSkeleton } from "@/components/layout/LoadingState";
import { Panel, Kpi, DataTable, Chip, StatusLED } from "../components/ui";
import { LatencyAreaChart } from "@/components/charts/MetricSparkline";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { GlobeScene3DLazy } from "@/components/globe/GlobeScene3DLazy";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function OverviewPage() {
  const { data: product, isLoading: productLoading } = useProduct();
  const { data: health } = useHealth();
  const { data: metrics, isLoading: metricsLoading } = useLiveMetrics();
  const { data: sync } = useSyncStatus();
  const { data: activity } = useActivity();
  const { data: history } = useMetricsHistory("latency_ms", 24);
  const { data: summary } = useMetricsSummary("latency_ms", 24);
  const { data: regions } = useRegions();

  const cache = metrics?.inference_cache;
  const hitPct = cache?.hit_rate != null ? Math.round(cache.hit_rate * 100) : null;
  const loading = productLoading || metricsLoading;
  const latencies = Object.fromEntries(
    (metrics?.router ?? []).filter((r) => r.latency_ms != null).map((r) => [r.region_id, r.latency_ms as number])
  );
  const healthyMap = Object.fromEntries((metrics?.router ?? []).map((r) => [r.region_id, r.healthy]));

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-xl opacity-25">
        <GlobeScene3DLazy
          className="h-full min-h-[420px] w-full"
          variant="ambient"
          regions={regions?.regions}
          latencies={latencies}
          healthy={healthyMap}
        />
      </div>
      <div className="relative z-10 space-y-6">
      <PageHeader
        title="Overview"
        description={
          product
            ? `${product.name} · ${product.catalog_products ?? 0} SKUs · ${product.knowledge_docs ?? 0} knowledge docs`
            : "Regional operations dashboard"
        }
      />

      {loading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            label="Regions healthy"
            value={`${metrics?.router.filter((r) => r.healthy).length ?? "—"}/${metrics?.router.length ?? "—"}`}
            sub={health?.replication_running ? "Replication active" : "Replication idle"}
          />
          <Kpi label="Sync cycles" value={sync?.cycles ?? "—"} sub={`Interval ${sync?.interval_s ?? "—"}s`} />
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
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Region probes">
          <DataTable
            headers={["Region", "Status", "Latency", "Circuit", "Peer"]}
            empty="No probe data — server warming up"
            rows={(metrics?.router ?? []).map((r) => [
              <span key="id">{r.region_id}</span>,
              <span key="s" className="inline-flex items-center gap-2">
                <StatusLED status={r.healthy ? "ok" : "err"} />
                {r.healthy ? "Healthy" : "Down"}
              </span>,
              r.latency_ms != null ? `${r.latency_ms} ms` : "—",
              <Chip key="c" variant={r.circuit === "open" ? "err" : "default"}>{r.circuit ?? "—"}</Chip>,
              <span key="p" className="truncate max-w-[120px] block text-muted-foreground">
                {r.peer_url ?? (r.is_local ? "local" : "—")}
              </span>,
            ])}
          />
        </Panel>

        <Panel title="Fleet registry" action={<Chip>{regions?.deployment_mode}</Chip>}>
          <DataTable
            headers={["ID", "Name", "Base ms", "Local", "Peer URL"]}
            rows={(regions?.regions ?? []).map((r) => [
              r.id,
              r.name,
              `${r.base_latency_ms}`,
              r.is_local ? "yes" : "no",
              <span key="u" className="truncate max-w-[140px] block text-muted-foreground">
                {r.peer_url ?? "—"}
              </span>,
            ])}
          />
        </Panel>
      </div>

      <Panel title="Latency history (24h)">
        <ChartContainer title="" description="">
          <LatencyAreaChart data={history?.points ?? []} />
        </ChartContainer>
      </Panel>

      <Panel title="Activity feed">
        <DataTable
          headers={["Time", "Type", "Summary"]}
          empty="No activity yet"
          rows={(activity?.items ?? []).slice(0, 20).map((a) => [
            relativeTime(a.ts),
            a.type,
            a.summary,
          ])}
        />
      </Panel>
      </div>
    </div>
  );
}
