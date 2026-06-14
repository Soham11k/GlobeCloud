import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobeMap } from "@/components/GlobeMap";
import { useHealth, useMetrics, useProduct } from "@/lib/hooks";

function UptimeBar({ pct }: { pct: number }) {
  return (
    <div className="flex gap-0.5 h-8">
      {[...Array(90)].map((_, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-sm min-w-[2px]"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.005 }}
          style={{
            backgroundColor: i / 90 < pct ? "var(--color-success)" : "var(--color-danger)",
            opacity: 0.7 + (i % 7) * 0.04,
          }}
        />
      ))}
    </div>
  );
}

export function StatusPage() {
  const { data: health, isLoading: hLoad } = useHealth();
  const { data: metrics, isLoading: mLoad } = useMetrics();
  const { data: product } = useProduct();

  const allHealthy = metrics?.router.every((r) => r.healthy) ?? false;
  const status = health?.status === "ok" && allHealthy ? "operational" : "degraded";
  const statusVariant = status === "operational" ? "success" : "warning";
  const uptimePct = allHealthy ? 0.99 : 0.92;

  return (
    <div className="min-h-screen gradient-mesh p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Globe2 className="h-5 w-5 text-accent" />
          GlobeCloud Status
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              System status
              {hLoad ? <Skeleton className="h-6 w-24" /> : <Badge variant={statusVariant}>{status}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-2">90-day uptime (simulated)</p>
              <UptimeBar pct={uptimePct} />
              <p className="text-xs text-muted-foreground mt-2">{Math.round(uptimePct * 1000) / 10}% uptime</p>
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
          <CardHeader><CardTitle>Regions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {mLoad
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)
              : metrics?.router.map((r) => (
                  <div key={r.region_id} className="flex justify-between py-2 border-b border-border last:border-0">
                    <span>{r.region_id}</span>
                    <div className="flex gap-2 items-center">
                      <Badge variant={r.healthy ? "success" : "danger"}>{r.healthy ? "ok" : "down"}</Badge>
                      <span className="text-muted-foreground">{r.latency_ms ?? "—"} ms</span>
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

        <p className="text-xs text-muted-foreground text-center">
          <Link to="/" className="text-accent hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
