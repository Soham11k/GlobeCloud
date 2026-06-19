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
import { useConsole } from "../ConsoleContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiSkeleton, LoadingState } from "@/components/layout/LoadingState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Panel, Kpi } from "../components/ui";
import { RegionProbeCard } from "../components/RegionProbeCard";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { LatencyAreaChart } from "@/components/charts/MetricSparkline";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { GeoVizPanel } from "@/components/globe/GeoVizPanel";

export function OverviewPage() {
  const { client, region } = useConsole();
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
    (metrics?.router ?? [])
      .filter((r) => r.latency_ms != null)
      .map((r) => [r.region_id, r.latency_ms as number]),
  );
  const healthyMap = Object.fromEntries((metrics?.router ?? []).map((r) => [r.region_id, r.healthy]));
  const healthyCount = metrics?.router.filter((r) => r.healthy).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command center"
        description={
          product
            ? `${product.name} · ${healthyCount}/${metrics?.router.length ?? 0} regions live · ${product.catalog_products ?? 0} SKUs`
            : "Regional operations dashboard"
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="console-panel overflow-hidden lg:col-span-2">
          {loading ? (
            <LoadingState rows={6} className="min-h-[320px]" />
          ) : (
          <GeoVizPanel
            className="w-full rounded-none border-0"
            height="min(420px, 52vh)"
            variant="hero"
            regions={regions?.regions}
            latencies={latencies}
            healthy={healthyMap}
            client={client}
            selected={region}
            showArc
            interactive
            showMapInset
          />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {loading ? (
            <KpiSkeleton />
          ) : (
            <>
              <Kpi
                label="Regions healthy"
                value={`${healthyCount}/${metrics?.router.length ?? "—"}`}
                sub={health?.replication_running ? "Replication active" : "Replication idle"}
                highlight={healthyCount === metrics?.router.length}
              />
              <Kpi
                label="Sync cycles"
                value={sync?.cycles ?? "—"}
                sub={`Interval ${sync?.interval_s ?? "—"}s`}
              />
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
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Live region probes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(metrics?.router ?? []).length ? (
            (metrics?.router ?? []).map((r) => (
              <RegionProbeCard
                key={r.region_id}
                regionId={r.region_id}
                healthy={r.healthy}
                latencyMs={r.latency_ms}
                circuit={r.circuit}
                peerUrl={r.peer_url}
                isLocal={r.is_local}
              />
            ))
          ) : (
            <EmptyState
              title="No probe data"
              description="Regional health probes will appear once the server finishes warming up."
              className="sm:col-span-2 lg:col-span-3"
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Latency history (24h)">
          <ChartContainer title="" description="">
            <LatencyAreaChart data={history?.points ?? []} />
          </ChartContainer>
        </Panel>

        <Panel title="Activity">
          <ActivityTimeline items={(activity?.items ?? []).slice(0, 15)} />
        </Panel>
      </div>
    </div>
  );
}
