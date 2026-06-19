import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Route, RefreshCw, MessageCircle, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWelcomed } from "@/lib/welcome";
import { useMetrics, useProduct, useSyncStatus, useRegions } from "@/lib/hooks";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { GlobeScene3DLazy } from "@/components/globe/GlobeScene3DLazy";

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
          Math.max(1, metrics.router.filter((r) => r.latency_ms != null).length)
      )
    : null;

  const enter = () => markWelcomed();

  return (
    <CinematicShell className="min-h-screen">
      <GlobeScene3DLazy
        className="fixed inset-0 z-0 h-full w-full"
        regions={regionsData?.regions}
        latencies={latencies}
        healthy={healthy}
        variant="hero"
      />

      <div className="pointer-events-none fixed inset-0 z-[1] cinematic-vignette" />

      <div className="relative z-10 flex min-h-screen flex-col pointer-events-none">
        <SiteHeader className="pointer-events-auto border-b border-border/50 bg-background/30 backdrop-blur-md" onNavigate={enter} />

        <motion.div
          className="pointer-events-auto flex max-w-xl flex-1 flex-col justify-center px-6 py-12 md:px-12 md:py-16"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-accent">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-accent" />
            {product?.regions ?? 3}-region · {product?.deployment_mode ?? "local"}
          </div>
          <h1 className="mb-4 text-4xl font-light leading-[1.05] tracking-[-0.035em] text-foreground sm:text-5xl md:text-[56px]">
            Your data,
            <br />
            <em className="font-bold not-italic">everywhere</em>
            <br />
            <span className="text-accent">at once.</span>
          </h1>
          <p className="mb-8 max-w-md text-sm leading-[1.75] text-muted-foreground">
            Replication across US, EU, and AP. Reads land on the nearest replica. Ask your docs in plain language.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" className="glow-ring" asChild>
              <Link to="/app" onClick={enter}>
                <Terminal className="h-4 w-4" /> Open console
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/api/docs" target="_blank" rel="noopener">
                Read the docs
              </a>
            </Button>
          </div>
        </motion.div>

        <div className="pointer-events-auto mt-auto grid grid-cols-3 border-t border-border/50 bg-background/40 backdrop-blur-md">
          <div className="border-r border-border/50 px-4 py-5 md:px-8">
            <div className="geo-healthy font-mono text-2xl font-medium tracking-[-0.03em] md:text-[28px]">
              {avgMs ?? "—"}
              <span className="text-xs font-normal opacity-40">ms</span>
            </div>
            <div className="text-[10px] tracking-wide text-muted-foreground md:text-[11px]">avg read latency</div>
          </div>
          <div className="border-r border-border/50 px-4 py-5 md:px-8">
            <div className="font-mono text-2xl font-medium tracking-[-0.03em] text-foreground md:text-[28px]">
              {sync?.interval_s ?? "—"}
              <span className="text-xs font-normal opacity-40">s</span>
            </div>
            <div className="text-[10px] tracking-wide text-muted-foreground md:text-[11px]">sync interval</div>
          </div>
          <div className="px-4 py-5 md:px-8">
            <div className="font-mono text-2xl font-medium tracking-[-0.03em] text-foreground md:text-[28px]">
              {product?.knowledge_docs ?? "—"}
              <span className="text-xs font-normal opacity-40"> docs</span>
            </div>
            <div className="text-[10px] tracking-wide text-muted-foreground md:text-[11px]">knowledge base</div>
          </div>
        </div>

        <div className="pointer-events-auto hidden border-t border-border/50 bg-background/30 backdrop-blur-sm md:grid md:grid-cols-3">
          {[
            { icon: Route, name: "Route", desc: "Latency-aware region selection. Reads hit the closest healthy node.", mono: "→ geo_routing: true" },
            { icon: RefreshCw, name: "Replicate", desc: "Append-only logs sync across regions. Full audit trail.", mono: "→ multi_region: true" },
            { icon: MessageCircle, name: "Ask", desc: "Grounded RAG copilot answers from your docs with citations.", mono: `→ rag_agent: ${product?.llm_mode ?? "openai"}` },
          ].map(({ icon: Icon, name, desc, mono }, i) => (
            <div
              key={name}
              className={`px-6 py-5 md:px-8 ${i < 2 ? "border-border/50 md:border-r" : ""}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-accent/30 text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{name}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
              <p className="mt-2 font-mono text-[10px] tracking-wider text-accent">{mono}</p>
            </div>
          ))}
        </div>

        <p className="pointer-events-auto border-t border-border/50 py-4 text-center text-[11px] text-muted-foreground">
          <Link to="/" onClick={enter} className="text-accent hover:underline">
            Continue to marketing site →
          </Link>
        </p>
      </div>
    </CinematicShell>
  );
}
