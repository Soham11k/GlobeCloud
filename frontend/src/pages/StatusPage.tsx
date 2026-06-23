import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { GlobeScenePanel } from "@/components/globe/GlobeScenePanel";
import { useMemo } from "react";
import {
  useHealth,
  useLiveMetrics,
  useProduct,
  useMetricsHistory,
  useFleetLatencySamples,
  useRegions,
  useGlobalStatus,
} from "@/lib/hooks";
import { cn } from "@/lib/utils";

function LiveMs({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="tabular-nums text-muted-foreground">—</span>;
  return (
    <span key={value} className="tabular-nums text-foreground animate-in fade-in duration-300">
      {Math.round(value)} ms
    </span>
  );
}

function UptimeBar({ samples }: { samples: { value: number; ts: string }[] }) {
  const slotsDesktop = 90;
  const slotsMobile = 36;
  const hasData = samples.length >= 3;

  const renderBar = (slots: number, mobile: boolean) => {
    if (!hasData) {
      return (
        <div
          className={cn("flex h-8 gap-0.5", mobile && "min-w-max")}
          role="img"
          aria-label="Uptime history loading"
        >
          {[...Array(slots)].map((_, i) => (
            <div
              key={i}
              className={cn(" bg-muted", mobile ? "h-8 w-2 shrink-0" : "min-w-[2px] flex-1")}
              style={{ opacity: 0.35 + (i % 5) * 0.06 }}
            />
          ))}
        </div>
      );
    }

    const recent = samples.slice(-slots);
    const padded = [...Array(Math.max(0, slots - recent.length)).fill(null), ...recent];

    return (
      <div
        className={cn("flex h-8 gap-0.5", mobile && "min-w-max")}
        role="list"
        aria-label="Latency uptime by sample"
      >
        {padded.map((s, i) => {
          const healthy = s && s.value < 500;
          const label = s
            ? `Sample ${i + 1}: ${Math.round(s.value)} ms, ${healthy ? "healthy" : "degraded"}`
            : `Sample ${i + 1}: no data`;
          return (
            <div
              key={i}
              role="listitem"
              aria-label={label}
              className={cn("", mobile ? "h-8 w-2 shrink-0" : "min-w-[2px] flex-1")}
              style={{
                backgroundColor: healthy ? "var(--geo-healthy)" : s ? "var(--geo-warn)" : "var(--muted)",
                opacity: s ? 0.85 : 0.2,
              }}
              title={s ? `${Math.round(s.value)} ms` : undefined}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="overflow-x-auto sm:hidden" tabIndex={0} aria-label="Scroll uptime history">
        {renderBar(slotsMobile, true)}
      </div>
      <div className="hidden sm:block">{renderBar(slotsDesktop, false)}</div>
    </>
  );
}

export function StatusPage() {
  const { data: health, isLoading: hLoad } = useHealth();
  const { data: metrics, isLoading: mLoad } = useLiveMetrics();
  const { data: product } = useProduct();
  const { data: regions } = useRegions();
  const isGateway = product?.deployment_mode === "gateway";
  const { data: fleet } = useGlobalStatus(!!isGateway);
  const { data: history } = useMetricsHistory("latency_ms", 168, true);
  const liveSamples = useFleetLatencySamples();

  const router = metrics?.router ?? [];
  const latencies = Object.fromEntries(
    router.filter((r) => r.latency_ms != null).map((r) => [r.region_id, r.latency_ms as number])
  );
  const healthyMap = Object.fromEntries(router.map((r) => [r.region_id, r.healthy]));

  const allHealthy = router.length > 0 && router.every((r) => r.healthy);
  const status = health?.status === "ok" && allHealthy ? "operational" : "degraded";
  const statusVariant = status === "operational" ? "success" : "warning";

  const points = useMemo(() => {
    const stored = history?.points ?? [];
    if (stored.length >= liveSamples.length) return stored;
    const merged = [...stored];
    for (const s of liveSamples) {
      if (!merged.some((p) => p.ts === s.ts)) merged.push(s);
    }
    return merged.slice(-90);
  }, [history?.points, liveSamples]);

  const hasHistory = points.length >= 3;
  const uptimePct = hasHistory
    ? points.filter((p) => p.value < 500).length / points.length
    : null;

  return (
    <CinematicShell>
      <SiteHeader showMarketingLinks={false} />
      <div className="section-wrap max-w-3xl space-y-6 py-8">
        <div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">System status</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live HTTP probes · updates every 3s
          </p>
        </div>

        <div className="console-panel space-y-4 p-6">
          <div className="flex items-center gap-3 text-base font-medium">
            Current status
            {hLoad ? <Skeleton className="h-6 w-24" /> : <Badge variant={statusVariant}>{status}</Badge>}
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Latency uptime (90-day window)</p>
            <UptimeBar samples={points} />
            <p className="mt-2 text-xs text-muted-foreground">
              {hasHistory
                ? `${Math.round((uptimePct ?? 0) * 1000) / 10}% under 500 ms (${points.length} samples)`
                : "Warming up — bars fill as live probes arrive (every 3s)."}
            </p>
          </div>
          <div className="flex justify-between border-b border-foreground py-2 text-sm">
            <span>API</span>
            <Badge variant={health?.status === "ok" ? "success" : "danger"}>{health?.status ?? "unknown"}</Badge>
          </div>
          <div className="flex justify-between border-b border-foreground py-2 text-sm">
            <span>Deployment</span>
            <span className="text-muted-foreground capitalize">
              {isGateway ? "gateway" : product?.deployment_mode ?? "—"}
            </span>
          </div>
          {isGateway && fleet && (
            <div className="flex justify-between border-b border-foreground py-2 text-sm">
              <span>Healthy regions</span>
              <span className="text-muted-foreground">
                {fleet.healthy_regions}/{fleet.total_regions}
              </span>
            </div>
          )}
          <div className="flex justify-between py-2 text-sm">
            <span>Replication</span>
            <Badge variant={health?.replication_running ? "success" : "default"}>
              {health?.replication_running ? "running" : "idle"}
            </Badge>
          </div>
        </div>

        <GlobeScenePanel
          className="w-full"
          height="18rem"
          regions={regions?.regions}
          latencies={latencies}
          healthy={healthyMap}
          variant="panel"
          showMapInset
        />

        <div className="console-panel p-6">
          <h2 className="mb-4 text-base font-medium">Regions</h2>
          <div className="space-y-2">
            {mLoad
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)
              : router.map((r) => (
                  <div
                    key={`${r.region_id}-${r.latency_ms}`}
                    className="flex justify-between border-b border-foreground py-2 text-sm last:border-0"
                  >
                    <span className="font-mono">{r.region_id}</span>
                    <div className="flex items-center gap-3">
                      <Badge variant={r.healthy ? "success" : "danger"}>{r.healthy ? "ok" : "down"}</Badge>
                      <LiveMs value={r.latency_ms} />
                    </div>
                  </div>
                ))}
          </div>
        </div>

        <div className="console-panel flex items-center justify-between gap-4 p-6">
          <p className="text-sm text-muted-foreground">Get notified about incidents</p>
          <Button variant="secondary" size="sm" asChild>
            <a href="mailto:status@globecloud.dev?subject=Subscribe">
              <Mail className="h-4 w-4" /> Subscribe
            </a>
          </Button>
        </div>

        <p className="pb-8 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </CinematicShell>
  );
}
