import { Link } from "react-router-dom";
import { Route, RefreshCw, MessageCircle, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWelcomed } from "@/lib/welcome";
import { useMetrics, useProduct, useSyncStatus, useRegions } from "@/lib/hooks";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { GlobeScenePanel } from "@/components/globe/GlobeScenePanel";

export function CinematicWelcomePage() {
  const { data: metrics } = useMetrics();
  const { data: product } = useProduct();
  const { data: sync } = useSyncStatus();
  const { data: regionsData } = useRegions();

  const latencies: Record<string, number> = {};
  const healthy: Record<string, boolean> = {};
  metrics?.router.forEach((r) => {
    if (r.latency_ms != null) latencies[r.region_id] = r.latency_ms;
    healthy[r.region_id] = r.healthy;
  });

  const avgMs = metrics?.router.length
    ? Math.round(
        metrics.router.filter((r) => r.latency_ms != null).reduce((s, r) => s + (r.latency_ms ?? 0), 0) /
          Math.max(1, metrics.router.filter((r) => r.latency_ms != null).length),
      )
    : null;

  const enter = () => markWelcomed();

  return (
    <CinematicShell className="min-h-screen">
      <SiteHeader className="console-chrome" onNavigate={enter} />

      <div className="section-wrap grid gap-8 py-10 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col justify-center">
          <p className="font-mono text-xs text-muted-foreground">
            {product?.deployment_mode ?? "local"} · {product?.regions ?? 3} regions
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            GlobeCloud console
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Probe latency across us-east-1, eu-west-1, and ap-south-1. Replication runs every{" "}
            {sync?.interval_s ?? "—"}s via transactional outbox.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/app" onClick={enter}>
                <Terminal className="h-4 w-4" /> Open console
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/api/docs" target="_blank" rel="noopener">
                API reference
              </a>
            </Button>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border/40 pt-6 font-mono text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">avg latency</dt>
              <dd className="mt-1 tabular-nums">{avgMs != null ? `${avgMs}ms` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">sync interval</dt>
              <dd className="mt-1 tabular-nums">{sync?.interval_s ?? "—"}s</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">knowledge docs</dt>
              <dd className="mt-1 tabular-nums">{product?.knowledge_docs ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <GlobeScenePanel
          className="w-full"
          height="min(400px, 50vh)"
          regions={regionsData?.regions}
          latencies={latencies}
          healthy={healthy}
          variant="hero"
          showMapInset
        />
      </div>

      <div className="section-wrap grid gap-6 border-t border-border py-10 md:grid-cols-3">
        {[
          { icon: Route, name: "Route", desc: "POST /api/v1/route picks the lowest-latency peer.", mono: "geo_routing: true" },
          { icon: RefreshCw, name: "Replicate", desc: "Outbox syncs catalog and orders across Postgres regions.", mono: "multi_region: true" },
          { icon: MessageCircle, name: "Agent", desc: "pgvector RAG with citations from regional knowledge docs.", mono: `llm: ${product?.llm_mode ?? "openai"}` },
        ].map(({ icon: Icon, name, desc, mono }) => (
          <div key={name} className="console-panel p-5">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">{name}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">{mono}</p>
          </div>
        ))}
      </div>

      <p className="section-wrap pb-8 text-center text-xs text-muted-foreground">
        <Link to="/" onClick={enter} className="text-accent hover:underline">
          Continue to marketing site →
        </Link>
      </p>
    </CinematicShell>
  );
}
