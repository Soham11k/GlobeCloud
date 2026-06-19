import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Probe = { region_id: string; healthy: boolean; latency_ms?: number | null };

type Props = {
  probes?: Probe[];
  syncInterval?: number | null;
  knowledgeDocs?: number | null;
  loading?: boolean;
  className?: string;
};

export function LiveStatBar({ probes = [], syncInterval, knowledgeDocs, loading, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {loading
        ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-28 bg-muted/50" />)
        : probes.map((r) => (
            <Badge
              key={r.region_id}
              variant={r.healthy ? "success" : "danger"}
              className="font-mono text-[11px] border border-border/60 bg-[var(--surface-1)]"
            >
              {r.region_id} · {r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : "—"}
            </Badge>
          ))}
      {syncInterval != null && (
        <Badge variant="accent" className="font-mono text-[11px] border border-border/60 bg-[var(--surface-1)]">
          sync {syncInterval}s
        </Badge>
      )}
      {knowledgeDocs != null && (
        <Badge variant="default" className="font-mono text-[11px] border border-border/60 bg-[var(--surface-1)]">
          {knowledgeDocs} docs
        </Badge>
      )}
    </div>
  );
}
