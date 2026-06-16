import { useAudit } from "@/lib/hooks";
import { Panel, DataTable, Chip } from "../components/ui";

export function AuditPage() {
  const { data, isLoading } = useAudit(100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Request audit</h1>
        <p className="console-mono mt-1 text-[var(--gc-dim)]">GET /audit · last 100 API requests on this host</p>
      </div>

      <Panel title="HTTP log">
        {isLoading ? (
          <p className="console-mono text-[var(--gc-dim)]">Loading…</p>
        ) : (
          <DataTable
            headers={["time", "method", "path", "status", "ms", "ip"]}
            empty="No audit entries yet — make some API requests"
            rows={(data?.entries ?? []).map((e) => [
              new Date(e.ts).toLocaleTimeString(),
              e.method,
              <span key="p" className="truncate max-w-[200px] block">{e.path}</span>,
              <Chip key="s" variant={e.status < 400 ? "ok" : e.status < 500 ? "warn" : "err"}>{e.status}</Chip>,
              e.duration_ms?.toFixed(1) ?? "—",
              e.client_ip ?? "—",
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
