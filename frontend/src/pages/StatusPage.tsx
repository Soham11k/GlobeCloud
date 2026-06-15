import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/Logo";
import { GlobeMap } from "@/components/GlobeMap";
import { useHealth, useMetrics, useProduct, useMetricsHistory } from "@/lib/hooks";

function UptimeBar({ samples }: { samples: { value: number; ts: string }[] }) {
  const slots = 90;
  const filled = samples.length >= 10;

  if (!filled) {
    return (
      <div className="flex gap-0.5 h-8">
        {[...Array(slots)].map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm min-w-[2px] bg-muted"
            style={{ opacity: 0.4 + (i % 5) * 0.08 }}
          />
        ))}
      </div>
    );
  }

  const recent = samples.slice(-slots);
  const padded = [...Array(Math.max(0, slots - recent.length)).fill(null), ...recent];

  return (
    <div className="flex gap-0.5 h-8">
      {padded.map((s, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm min-w-[2px]"
          style={{
            backgroundColor: s && s.value < 500 ? "var(--color-success)" : s ? "var(--color-warning)" : "var(--color-muted)",
            opacity: s ? 0.75 : 0.25,
          }}
          title={s ? `${Math.round(s.value)} ms` : undefined}
        />
      ))}
    </div>
  );
}

export function StatusPage() {
  const { data: health, isLoading: hLoad } = useHealth();
  const { data: metrics, isLoading: mLoad } = useMetrics();
  const { data: product } = useProduct();
  const { data: history } = useMetricsHistory("latency_ms", 24 * 90);

  const allHealthy = metrics?.router.every((r) => r.healthy) ?? false;
  const status = health?.status === "ok" && allHealthy ? "operational" : "degraded";
  const statusVariant = status === "operational" ? "success" : "warning";
  const points = history?.points ?? [];
  const hasHistory = points.length >= 10;
  const uptimePct = hasHistory
    ? points.filter((p) => p.value < 500).length / points.length
    : null;

  return (
    <div className="min-h-screen page-shell p-6">
      <div className="section-wrap max-w-3xl space-y-6">
        <Logo to="/" />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight mt-6">System status</h1>
          <p className="text-sm text-muted-foreground mt-1">Rolling 90-day window from metrics history when available.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              Current status
              {hLoad ? <Skeleton className="h-6 w-24" /> : <Badge variant={statusVariant}>{status}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-2">Latency uptime (90-day window)</p>
              <UptimeBar samples={points} />
              <p className="text-xs text-muted-foreground mt-2">
                {hasHistory
                  ? `${Math.round((uptimePct ?? 0) * 1000) / 10}% under 500 ms (${points.length} samples)`
                  : "Collecting samples — check back after the server has been running."}
              </p>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span>API</span>
              <Badge variant={health?.status === "ok" ? "success" : "danger"}>{health?.status ?? "unknown"}</Badge>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span>Deployment</span>
              <span className="text-muted-foreground">{product?.deployment_mode ?? "—"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Replication</span>
              <Badge variant={health?.replication_running ? "success" : "default"}>
                {health?.replication_running ? "running" : "idle"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden p-0">
          <GlobeMap probes={metrics?.router.map((r) => ({ region_id: r.region_id, healthy: r.healthy })) ?? []} className="w-full h-40" />
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Regions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {mLoad
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)
              : metrics?.router.map((r) => (
                  <div key={r.region_id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                    <span className="font-mono">{r.region_id}</span>
                    <div className="flex gap-2 items-center">
                      <Badge variant={r.healthy ? "success" : "danger"}>{r.healthy ? "ok" : "down"}</Badge>
                      <span className="text-muted-foreground tabular-nums">{r.latency_ms ?? "—"} ms</span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Get notified about incidents</p>
            <Button variant="secondary" size="sm" asChild>
              <a href="mailto:status@globecloud.dev?subject=Subscribe"><Mail className="h-4 w-4" /> Subscribe</a>
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center pb-8">
          <Link to="/" className="text-accent hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
