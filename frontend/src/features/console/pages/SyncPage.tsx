import { useSyncStatus, useSyncMutation } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Panel, DataTable, Kpi, StatusLED } from "../components/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ReactNode } from "react";

export function SyncPage() {
  const { data: sync, isLoading, isError, refetch } = useSyncStatus();
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

  const steps = [
    { label: "Outbox write", done: true },
    { label: "Peer pull", done: (sync?.cycles ?? 0) > 0 },
    { label: "Apply entries", done: (sync?.last_entries_applied ?? 0) > 0 },
    { label: "Peers in sync", done: lagRows.length === 0 && (sync?.running ?? false) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Replication"
        description={`Transactional outbox · ${sync?.mode ?? "—"} · local ${sync?.local_region ?? "—"}`}
        actions={
          <Button
            disabled={syncRun.isPending}
            onClick={() =>
              syncRun.mutate(undefined, {
                onSuccess: (d) => toast.success(`Applied ${d.entries_applied ?? 0} entries`),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            {syncRun.isPending ? "Syncing…" : "Force sync"}
          </Button>
        }
      />

      {isError ? (
        <ErrorState
          title="Replication status unavailable"
          description="Could not load sync engine state."
          onRetry={() => refetch()}
        />
      ) : (
      <>
      <div className="flex flex-wrap gap-4">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-shadow ${
                step.done
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className="text-sm">{step.label}</span>
            {i < steps.length - 1 && <span className="hidden sm:inline text-muted-foreground">→</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Engine"
          value={
            <span className="inline-flex items-center gap-2">
              <StatusLED status={sync?.running ? "ok" : "off"} />
              {sync?.running ? "Running" : "Stopped"}
            </span>
          }
        />
        <Kpi label="Cycles" value={sync?.cycles ?? "—"} />
        <Kpi label="Last applied" value={sync?.last_entries_applied ?? "—"} sub="entries" />
        <Kpi label="Peer errors" value={sync?.peer_errors ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Regional databases">
          {isLoading ? (
            <LoadingState rows={3} />
          ) : (
            <DataTable
              headers={["Region", "Local", "Products", "Orders", "Log entries"]}
              rows={Object.entries(sync?.regions ?? {}).map(([id, r]) => [
                id,
                r.local ? "yes" : "no",
                r.stats?.products ?? "—",
                r.stats?.orders ?? "—",
                r.stats?.replication_log_entries ?? r.stats?.entries ?? "—",
              ])}
            />
          )}
        </Panel>

        <Panel title="Replication lag">
          <DataTable
            headers={["From", "To", "Behind", "Applied seq", "Head seq"]}
            empty="No lag — peers in sync"
            rows={lagRows}
          />
        </Panel>
      </div>
      </>
      )}
    </div>
  );
}
