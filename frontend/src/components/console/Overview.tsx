import { motion } from "framer-motion";
import { Play, RefreshCw, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CHECKLIST_KEY } from "@/lib/utils";
import { useHealth, useMetrics, useSyncStatus, useMetricsHistory, useMetricsStream, useActivity } from "@/lib/hooks";
import { sparklineData } from "@/lib/metricsBuffer";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { LatencyAreaChart, LatencyBarChart, MetricSparkline } from "@/components/charts/MetricSparkline";
import { pageVariants } from "@/lib/motion";

const STEPS = ["connected", "routed", "ordered", "asked"] as const;

function loadChecklist() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function OverviewPanel({
  onDemo,
  onSync,
}: {
  onDemo: () => void;
  onSync: () => void;
}) {
  useMetricsStream();
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: sync } = useSyncStatus();
  const { data: history } = useMetricsHistory("latency_ms", 24);
  const { data: activity } = useActivity();
  const checklist = loadChecklist();
  const done = STEPS.filter((s) => checklist[s]).length;
  const chartData =
    metrics?.router.map((r) => ({
      name: r.region_id.replace(/-/g, " "),
      ms: r.latency_ms ?? 0,
      healthy: r.healthy,
    })) ?? [];

  const kpis = [
    { label: "Regions", value: metrics?.router.length ?? "—", spark: null },
    {
      label: "Healthy",
      value: metrics
        ? `${metrics.router.filter((r) => r.healthy).length}/${metrics.router.length}`
        : "—",
      spark: null,
    },
    { label: "Sync cycles", value: sync?.cycles ?? "—", spark: "sync" },
    {
      label: "Cache hit",
      value:
        metrics?.inference_cache?.hit_rate != null
          ? `${Math.round(metrics.inference_cache.hit_rate * 100)}%`
          : "—",
      spark: "cache_hit",
    },
  ];

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="initial" animate="animate">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Getting started</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{done}/{STEPS.length} complete</p>
          </div>
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-muted)" strokeWidth="3" />
              <motion.circle
                cx="18" cy="18" r="16" fill="none" stroke="var(--color-accent)" strokeWidth="3"
                strokeDasharray={`${(done / STEPS.length) * 100} 100`}
                initial={{ strokeDasharray: "0 100" }}
                animate={{ strokeDasharray: `${(done / STEPS.length) * 100} 100` }}
                transition={{ duration: 0.8 }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
              {Math.round((done / STEPS.length) * 100)}%
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onDemo}><Play className="h-4 w-4" /> Guided tour</Button>
            <Button variant="secondary" onClick={onSync}><RefreshCw className="h-4 w-4" /> Sync now</Button>
            <Button variant="outline" asChild><Link to="/app/copilot"><Bot className="h-4 w-4" /> Open copilot</Link></Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, spark }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                {metricsLoading && label !== "Sync cycles" ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold mt-1">{value}</p>
                )}
                {spark && <div className="mt-2"><MetricSparkline data={sparklineData(spark)} /></div>}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {activity?.items?.length ? (
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-40 overflow-auto">
            {activity.items.slice(0, 8).map((item, i) => (
              <motion.div
                key={`${item.ts}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex justify-between text-sm border-b border-border pb-2 last:border-0"
              >
                <span className="truncate">{item.summary}</span>
                <span className="text-muted-foreground text-xs shrink-0 ml-2">
                  {new Date(item.ts).toLocaleTimeString()}
                </span>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Region health</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {metricsLoading
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : metrics?.router.map((r) => (
                  <div key={r.region_id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                    <span>{r.region_id}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.healthy ? "success" : "danger"}>{r.healthy ? "ok" : "down"}</Badge>
                      <span className="text-muted-foreground">{r.latency_ms ?? "—"} ms</span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ChartContainer title="Latency by region" description="Live probe snapshot">
              {metricsLoading ? <Skeleton className="h-full w-full" /> : (
                <LatencyBarChart data={chartData} />
              )}
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ChartContainer title="Latency history (24h)" description="Sampled every 30s">
            <LatencyAreaChart data={history?.points ?? []} />
          </ChartContainer>
        </CardContent>
      </Card>

      {!healthLoading && health && (
        <p className="text-xs text-muted-foreground">
          {health.deployment_mode}
          {health.deployment_mode === "local" ? " · 3 SQLite replicas on this host" : ""}
          {" · "}{health.llm_mode} LLM · replication {health.replication_running ? "active" : "idle"}
        </p>
      )}
    </motion.div>
  );
}

export function markChecklist(step: string) {
  const state = loadChecklist();
  state[step] = true;
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
}
