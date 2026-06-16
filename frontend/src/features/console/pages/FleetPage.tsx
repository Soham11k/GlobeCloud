import { useGlobalStatus } from "@/lib/hooks";
import { Panel, DataTable, Kpi, StatusLED } from "../components/ui";
import { GlobeMap } from "@/components/GlobeMap";

export function FleetPage() {
  const { data, isLoading, isError, error } = useGlobalStatus(true);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Global fleet</h1>
        <p className="console-mono mt-1 text-[var(--gc-dim)]">GET /global/status · gateway deployment only</p>
      </div>

      <Panel title="Topology">
        <GlobeMap
          probes={data?.regions.map((r) => ({ region_id: r.region_id, healthy: r.healthy })) ?? []}
          className="w-full h-56"
        />
      </Panel>

      {isLoading ? (
        <p className="console-mono text-[var(--gc-dim)]">Probing peers…</p>
      ) : isError ? (
        <p className="text-[var(--gc-err)] console-mono text-sm">{(error as Error).message}</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {data?.regions.map((r) => (
            <Kpi
              key={r.region_id}
              label={r.region_id}
              value={
                <span className="inline-flex items-center gap-2">
                  <StatusLED status={r.healthy ? "ok" : "err"} />
                  {r.latency_ms ?? "—"}ms
                </span>
              }
              sub={r.healthy ? "healthy" : "unreachable"}
            />
          ))}
        </div>
      )}

      <Panel title="Peer detail">
        <DataTable
          headers={["region", "healthy", "latency"]}
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
