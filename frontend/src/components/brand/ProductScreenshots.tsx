import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMetrics, useSyncStatus, useActivity, useCatalog } from "@/lib/hooks";

const TABS = [
  { id: "routing", label: "Routing" },
  { id: "replication", label: "Replication" },
  { id: "copilot", label: "Copilot" },
] as const;

/** Live console panels — data from /metrics, /sync/status, /activity, /catalog */
export function ProductScreenshots({ className }: { className?: string }) {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("routing");
  const { data: metrics, isLoading: mLoad } = useMetrics();
  const { data: sync, isLoading: sLoad } = useSyncStatus();
  const { data: activity, isLoading: aLoad } = useActivity();
  const { data: catalog } = useCatalog();

  const routeEvents = activity?.items.filter((i) => i.type === "route") ?? [];
  const agentEvents = activity?.items.filter((i) => i.type === "agent") ?? [];

  return (
    <div className={className}>
      <div className="flex gap-2 mb-4">
        {TABS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setActive(v.id)}
            className={cn(
              "px-3 py-1.5  text-sm font-medium transition-colors",
              active === v.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className=" border border-border bg-background min-h-[220px] p-4 text-sm">
        {active === "routing" && (
          mLoad ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              <p className="font-medium">Live router snapshot</p>
              {metrics?.router.length ? (
                metrics.router.map((r) => (
                  <div key={r.region_id} className="flex justify-between text-xs py-1.5 border-b border-foreground last:border-0">
                    <span className="font-mono">{r.region_id}</span>
                    <div className="flex gap-2 items-center">
                      <Badge variant={r.healthy ? "success" : "danger"}>{r.healthy ? "ok" : "down"}</Badge>
                      <span className="tabular-nums text-muted-foreground">{r.latency_ms ?? "—"} ms</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Waiting for region probes…</p>
              )}
              {routeEvents[0] && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Last route: {routeEvents[0].summary}
                </p>
              )}
            </div>
          )
        )}

        {active === "replication" && (
          sLoad ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              <p className="font-medium">Sync engine · {sync?.cycles ?? 0} cycles</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(sync?.regions ?? {}).map(([region, info]) => (
                  <div key={region} className=" border border-border p-2 text-center">
                    <p className="text-[10px] text-muted-foreground truncate">{region.split("-")[0]}</p>
                    <p className="text-xs font-medium mt-1">
                      {info.stats?.replication_log_entries ?? info.stats?.entries ?? "—"} log entries
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Interval {sync?.interval_s ?? "—"}s · {sync?.running ? "running" : "stopped"}
              </p>
            </div>
          )
        )}

        {active === "copilot" && (
          aLoad ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              <p className="font-medium">Knowledge base</p>
              <p className="text-xs text-muted-foreground">
                {catalog?.knowledge_docs ?? "—"} docs indexed for RAG across regions.
              </p>
              {agentEvents.length ? (
                <div className=" border border-border p-3 bg-card text-xs space-y-2">
                  <p className="text-muted-foreground">Latest copilot query</p>
                  <p>{agentEvents[0].summary}</p>
                  {agentEvents[0].selected_region && (
                    <Badge variant="accent">{agentEvents[0].selected_region}</Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No copilot queries yet — open the console and ask a question.
                </p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
