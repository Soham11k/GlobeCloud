import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSyncStatus, useSyncMutation } from "@/lib/hooks";
import { pushMetric } from "@/lib/metricsBuffer";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function ReplicationPanel() {
  const { data: sync, isLoading } = useSyncStatus();
  const syncRun = useSyncMutation();

  useEffect(() => {
    if (sync?.cycles != null) pushMetric("sync", sync.cycles);
  }, [sync?.cycles]);

  const lagEntries: { label: string; value: number }[] = [];
  if (sync?.regions) {
    Object.entries(sync.regions).forEach(([regionId, r]) => {
      (r.sync_lag || []).forEach((entry) => {
        lagEntries.push({
          label: `${regionId}→${entry.peer_region}`,
          value: entry.behind_by ?? 0,
        });
      });
    });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sync engine</CardTitle>
          <motion.span
            animate={{ opacity: sync?.running ? [1, 0.4, 1] : 1 }}
            transition={{ repeat: sync?.running ? Infinity : 0, duration: 1.5 }}
            className={`h-2 w-2 rounded-full ${sync?.running ? "bg-success" : "bg-muted-foreground"}`}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Cycles: {sync?.cycles ?? 0} · Running: {sync?.running ? "yes" : "no"}
              </p>
              <div className="space-y-1 text-sm">
                {sync?.regions &&
                  Object.entries(sync.regions).map(([id, r]) => (
                    <div key={id} className="flex justify-between py-1 border-b border-border/50">
                      <span>{id}</span>
                      <span className="text-muted-foreground">
                        {r.stats?.replication_log_entries ?? r.stats?.entries ?? 0} entries
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}
          <Button
            onClick={() =>
              syncRun.mutate(undefined, {
                onSuccess: (d) => toast.success(`Synced ${d.entries_applied ?? 0} entries`),
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={syncRun.isPending}
          >
            {syncRun.isPending ? "Syncing…" : "Force sync"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Regional lag</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : lagEntries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lagEntries}>
                <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {lagEntries.map((e, i) => (
                    <Cell key={i} fill={e.value > 10 ? "#f59e0b" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No lag data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
