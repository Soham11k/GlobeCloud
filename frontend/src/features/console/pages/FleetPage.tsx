import { useGlobalStatus, useRegions, useLiveMetrics } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { Panel, DataTable, Kpi, StatusLED } from "../components/ui";
import { GlobeScenePanel } from "@/components/globe/GlobeScenePanel";

export function FleetPage() {
  const { data, isLoading, isError, error } = useGlobalStatus(true);
  const { data: regions } = useRegions();
  const { data: liveMetrics } = useLiveMetrics();

  const fleetRegions = data?.regions ?? liveMetrics?.router ?? [];
  const latencies = Object.fromEntries(
    fleetRegions.filter((r) => r.latency_ms != null).map((r) => [r.region_id, r.latency_ms as number])
  );
  const healthy = Object.fromEntries(fleetRegions.map((r) => [r.region_id, r.healthy]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global fleet"
        description="Gateway deployment — aggregated health across all regional peers."
      />

      <Panel title="Topology">
        <GlobeScenePanel
          className="w-full"
          height="14rem"
          regions={regions?.regions}
          latencies={latencies}
          healthy={healthy}
          variant="panel"
        />
      </Panel>

      {isLoading ? (
        <LoadingState rows={3} />
      ) : isError ? (
        <div className="glass-panel p-4 text-sm text-destructive">{(error as Error).message}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.regions.map((r) => (
            <Kpi
              key={r.region_id}
              label={r.region_id}
              highlight={r.healthy}
              value={
                <span className="inline-flex items-center gap-2">
                  <StatusLED status={r.healthy ? "ok" : "err"} />
                  {r.latency_ms ?? "—"}ms
                </span>
              }
              sub={r.healthy ? "Healthy" : "Unreachable"}
            />
          ))}
        </div>
      )}

      <Panel title="Peer detail">
        <DataTable
          headers={["Region", "Healthy", "Latency"]}
          rows={(data?.regions ?? []).map((r) => [
            r.region_id,
            r.healthy ? "yes" : "no",
            r.latency_ms != null ? `${r.latency_ms} ms` : "—",
          ])}
        />
      </Panel>
    </div>
  );
}
