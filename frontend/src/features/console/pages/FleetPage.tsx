import { useGlobalStatus, useRegions, useLiveMetrics } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { Panel, DataTable } from "../components/ui";
import { RegionProbeCard } from "../components/RegionProbeCard";
import { GeoVizPanel } from "@/components/globe/GeoVizPanel";

export function FleetPage() {
  const { data, isLoading, isError, error } = useGlobalStatus(true);
  const { data: regions } = useRegions();
  const { data: liveMetrics } = useLiveMetrics();

  const fleetRegions = data?.regions ?? liveMetrics?.router ?? [];
  const latencies = Object.fromEntries(
    fleetRegions.filter((r) => r.latency_ms != null).map((r) => [r.region_id, r.latency_ms as number]),
  );
  const healthy = Object.fromEntries(fleetRegions.map((r) => [r.region_id, r.healthy]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global fleet"
        meta="gateway"
        description="Aggregated probe health across regional Postgres peers."
      />

      <div className="console-panel overflow-hidden">
        <GeoVizPanel
          className="w-full rounded-none border-0"
          height="min(320px, 40vh)"
          variant="hero"
          regions={regions?.regions}
          latencies={latencies}
          healthy={healthy}
          showMapInset
        />
      </div>

      {isLoading ? (
        <LoadingState rows={3} />
      ) : isError ? (
        <div className="console-panel p-4 text-sm text-destructive">{(error as Error).message}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.regions ?? []).map((r) => (
            <RegionProbeCard
              key={r.region_id}
              regionId={r.region_id}
              healthy={r.healthy}
              latencyMs={r.latency_ms}
            />
          ))}
        </div>
      )}

      <Panel title="Peer detail">
        <DataTable
          headers={["region_id", "healthy", "latency_ms"]}
          rows={(data?.regions ?? []).map((r) => [
            r.region_id,
            r.healthy ? "true" : "false",
            r.latency_ms != null ? `${r.latency_ms}` : "—",
          ])}
        />
      </Panel>
    </div>
  );
}
