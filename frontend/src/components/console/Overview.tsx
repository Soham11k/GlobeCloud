import { motion } from "framer-motion";
import { Play, RefreshCw, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CHECKLIST_KEY } from "@/lib/utils";
import { useHealth, useMetrics, useSyncStatus } from "@/lib/hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: sync } = useSyncStatus();
  const checklist = loadChecklist();
  const done = STEPS.filter((s) => checklist[s]).length;
  const chartData =
    metrics?.router.map((r) => ({
      name: r.region_id.replace("-", " "),
      ms: r.latency_ms ?? 0,
      healthy: r.healthy,
    })) ?? [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Getting started</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {done}/{STEPS.length} complete
              </p>
            </div>
            <div className="relative h-12 w-12">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#27272a" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeDasharray={`${(done / STEPS.length) * 100} 100`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                {Math.round((done / STEPS.length) * 100)}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm">
              {[
                ["connected", "Server connected"],
                ["routed", "Run a route"],
                ["ordered", "Place an order"],
                ["asked", "Ask the copilot"],
              ].map(([key, label]) => (
                <li key={key} className="flex items-center gap-2">
                  <span className={checklist[key] ? "text-success" : "text-muted-foreground"}>
                    {checklist[key] ? "✓" : "○"}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={onDemo}>
                <Play className="h-4 w-4" /> Run demo flow
              </Button>
              <Button variant="secondary" onClick={onSync}>
                <RefreshCw className="h-4 w-4" /> Sync now
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/copilot">
                  <Bot className="h-4 w-4" /> Open copilot
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Regions", metrics?.router.length ?? "—"],
          [
            "Healthy",
            metrics
              ? `${metrics.router.filter((r) => r.healthy).length}/${metrics.router.length}`
              : "—",
          ],
          ["Sync cycles", sync?.cycles ?? "—"],
          [
            "Cache hit",
            metrics?.inference_cache?.hit_rate != null
              ? `${Math.round(metrics.inference_cache.hit_rate * 100)}%`
              : "—",
          ],
        ].map(([label, value], i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                {metricsLoading && label !== "Sync cycles" ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold mt-1">{value}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Region health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metricsLoading
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : metrics?.router.map((r) => (
                  <div key={r.region_id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                    <span>{r.region_id}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.healthy ? "success" : "danger"}>
                        {r.healthy ? "ok" : "down"}
                      </Badge>
                      <span className="text-muted-foreground">{r.latency_ms ?? "—"} ms</span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latency by region</CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            {metricsLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a" }}
                  />
                  <Bar dataKey="ms" radius={[4, 4, 0, 0]}>
                    {chartData.map((e, i) => (
                      <Cell key={i} fill={e.healthy ? "#3b82f6" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {!healthLoading && health && (
        <p className="text-xs text-muted-foreground">
          {health.deployment_mode} · {health.llm_mode} LLM · replication{" "}
          {health.replication_running ? "active" : "idle"}
        </p>
      )}
    </div>
  );
}

export function markChecklist(step: string) {
  const state = loadChecklist();
  state[step] = true;
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
}
