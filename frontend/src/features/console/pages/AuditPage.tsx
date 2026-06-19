import { useAudit } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { Panel, DataTable, Chip } from "../components/ui";

export function AuditPage() {
  const { data, isLoading } = useAudit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Last 100 API requests on this host. Export via GET /api/v1/audit for integrations."
      />

      <Panel title="HTTP requests">
        {isLoading ? (
          <LoadingState rows={6} />
        ) : (
          <DataTable
            headers={["Time", "Method", "Path", "Status", "ms", "IP"]}
            empty="No audit entries yet — make some API requests"
            rows={(data?.entries ?? []).map((e) => [
              new Date(e.ts).toLocaleTimeString(),
              e.method,
              <span key="p" className="truncate max-w-[200px] block">{e.path}</span>,
              <Chip key="s" variant={e.status < 400 ? "ok" : e.status < 500 ? "warn" : "err"}>{e.status}</Chip>,
              e.duration_ms?.toFixed(1) ?? "—",
              <span key="ip" className="font-mono text-xs">{e.client_ip ?? "—"}</span>,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
