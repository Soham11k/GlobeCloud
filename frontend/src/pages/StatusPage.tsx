import { Link } from "react-router-dom";
import { Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth, useMetrics, useProduct } from "@/lib/hooks";

export function StatusPage() {
  const { data: health, isLoading: hLoad } = useHealth();
  const { data: metrics, isLoading: mLoad } = useMetrics();
  const { data: product } = useProduct();

  const allHealthy = metrics?.router.every((r) => r.healthy) ?? false;
  const status = health?.status === "ok" && allHealthy ? "operational" : "degraded";
  const statusVariant = status === "operational" ? "success" : "warning";

  return (
    <div className="min-h-screen gradient-mesh p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Globe2 className="h-5 w-5 text-accent" />
          GlobeCloud Status
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              System status
              {hLoad ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Badge variant={statusVariant}>{status}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span>API</span>
              <Badge variant={health?.status === "ok" ? "success" : "danger"}>
                {health?.status ?? "unknown"}
              </Badge>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span>Deployment</span>
              <span className="text-muted-foreground">{product?.deployment_mode ?? "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span>LLM</span>
              <span className="text-muted-foreground">{product?.llm_mode ?? "—"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Replication</span>
              <Badge variant={health?.replication_running ? "success" : "default"}>
                {health?.replication_running ? "running" : "idle"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mLoad
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)
              : metrics?.router.map((r) => (
                  <div key={r.region_id} className="flex justify-between py-2 border-b border-border last:border-0">
                    <span>{r.region_id}</span>
                    <div className="flex gap-2 items-center">
                      <Badge variant={r.healthy ? "success" : "danger"}>
                        {r.healthy ? "ok" : "down"}
                      </Badge>
                      <span className="text-muted-foreground">{r.latency_ms ?? "—"} ms</span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          <Link to="/" className="text-accent hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
