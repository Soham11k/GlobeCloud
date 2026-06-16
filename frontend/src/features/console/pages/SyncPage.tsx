import { useSyncStatus, useSyncMutation } from "@/lib/hooks";
import { Panel, DataTable, Kpi, StatusLED } from "../components/ui";
import { toast } from "sonner";
import type { ReactNode } from "react";

export function SyncPage() {
  const { data: sync, isLoading } = useSyncStatus();
  const syncRun = useSyncMutation();

  const lagRows: ReactNode[][] = [];
  if (sync?.regions) {
    Object.entries(sync.regions).forEach(([regionId, r]) => {
      (r.sync_lag ?? []).forEach((entry) => {
        lagRows.push([
          regionId,
          entry.peer_region,
          entry.behind_by,
          entry.last_applied_seq ?? "—",
          entry.local_head_seq ?? "—",
        ]);
      });
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Replication</h1>
        <p className="console-mono mt-1 text-[var(--gc-dim)]">
          GET /sync/status · mode {sync?.mode ?? "—"} · local {sync?.local_region ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Engine"
          value={
            <span className="inline-flex items-center gap-2">
              <StatusLED status={sync?.running ? "ok" : "off"} />
              {sync?.running ? "running" : "stopped"}
            </span>
          }
        />
        <Kpi label="Cycles" value={sync?.cycles ?? "—"} />
        <Kpi label="Last applied" value={sync?.last_entries_applied ?? "—"} sub="entries" />
        <Kpi label="Peer errors" value={sync?.peer_errors ?? 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Regional databases">
          {isLoading ? (
            <p className="console-mono text-[var(--gc-dim)]">Loading…</p>
          ) : (
            <DataTable
              headers={["region", "local", "products", "orders", "log entries"]}
              rows={Object.entries(sync?.regions ?? {}).map(([id, r]) => [
                id,
                r.local ? "yes" : "no",
                r.stats?.products ?? "—",
                r.stats?.orders ?? "—",
                r.stats?.replication_log_entries ?? r.stats?.entries ?? "—",
              ])}
            />
          )}
          <button
            type="button"
            className="console-btn console-btn-primary mt-4"
            disabled={syncRun.isPending}
            onClick={() =>
              syncRun.mutate(undefined, {
                onSuccess: (d) => toast.success(`Applied ${d.entries_applied ?? 0} entries`),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            {syncRun.isPending ? "Syncing…" : "POST /sync/run"}
          </button>
        </Panel>

        <Panel title="Replication lag">
          <DataTable
            headers={["from", "to", "behind", "applied seq", "head seq"]}
            empty="No lag — peers in sync"
            rows={lagRows}
          />
        </Panel>
      </div>
    </div>
  );
}
