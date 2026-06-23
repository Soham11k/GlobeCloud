import { Link } from "react-router-dom";
import { Route, RefreshCw, MessageCircle, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotLabel } from "@/components/brand/DotLabel";
import { markWelcomed } from "@/lib/welcome";
import { useMetrics, useProduct, useSyncStatus, useRegions } from "@/lib/hooks";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { GlobeScenePanel } from "@/components/globe/GlobeScenePanel";

const FEATURES = [
  { icon: Route, name: "Route", desc: "POST /api/v1/route picks the lowest-latency peer.", mono: "geo_routing: true" },
  { icon: RefreshCw, name: "Replicate", desc: "Outbox syncs catalog and orders across Postgres regions.", mono: "multi_region: true" },
  { icon: MessageCircle, name: "Agent", desc: "pgvector RAG with citations from regional knowledge docs.", mono: "llm: openai" },
];

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
  const features = FEATURES.map((f) =>
    f.name === "Agent" ? { ...f, mono: `llm: ${product?.llm_mode ?? "openai"}` } : f,
  );

  return (
    <CinematicShell className="min-h-screen">
      <SiteHeader className="console-chrome" onNavigate={enter} />

      <div className="section-wrap grid min-h-[min(80vh,720px)] lg:grid-cols-2">
        <div className="flex flex-col justify-center py-14 lg:py-20 lg:pr-12">
          <DotLabel>
            {product?.deployment_mode ?? "local"} · {product?.regions ?? 3} regions
          </DotLabel>
          <h1 className="mt-5 text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.04em]">
            GlobeCloud console
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
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
          <dl className="mt-12 grid grid-cols-3 gap-px bg-border">
            <div className="bg-background p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Avg latency</dt>
              <dd className="mt-2 text-2xl font-medium tabular-nums tracking-[-0.03em]">{avgMs != null ? `${avgMs}ms` : "—"}</dd>
            </div>
            <div className="bg-background p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sync</dt>
              <dd className="mt-2 text-2xl font-medium tabular-nums tracking-[-0.03em]">{sync?.interval_s ?? "—"}s</dd>
            </div>
            <div className="bg-background p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Docs</dt>
              <dd className="mt-2 text-2xl font-medium tabular-nums tracking-[-0.03em]">{product?.knowledge_docs ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="relative min-h-[36vh] lg:min-h-0">
          <GlobeScenePanel
            className="absolute inset-0 h-full w-full border-0 bg-transparent"
            height="100%"
            regions={regionsData?.regions}
            latencies={latencies}
            healthy={healthy}
            variant="hero"
            showMapInset
          />
        </div>
      </div>

      <div className="border-t border-border">
        <div className="section-wrap grid gap-px bg-border md:grid-cols-3">
          {features.map(({ icon: Icon, name, desc, mono }) => (
            <div key={name} className="bg-background p-8">
              <div className="mb-4 flex items-center gap-2">
                <Icon className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">{name}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">{mono}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="section-wrap py-10 text-center text-sm text-muted-foreground">
        <Link to="/" onClick={enter} className="hover:text-accent">
          Continue to marketing site →
        </Link>
      </p>
    </CinematicShell>
  );
}
