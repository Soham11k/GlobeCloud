import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Route, RefreshCw, MessageCircle, Terminal } from "lucide-react";
import { markWelcomed } from "@/lib/welcome";
import { useMetrics, useProduct, useSyncStatus, useRegions } from "@/lib/hooks";
import { WelcomeScene3DLazy } from "@/components/welcome/WelcomeScene3DLazy";

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
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative min-h-screen overflow-hidden text-[#F0EDE6]"
        style={{ background: "var(--surface-0,#03030A)", fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {/* Full-viewport 3D scene */}
        <WelcomeScene3DLazy
          className="fixed inset-0 z-0 h-full w-full"
          regions={regionsData?.regions}
          latencies={latencies}
          healthy={healthy}
        />

        {/* CSS vignette */}
        <div
          className="pointer-events-none fixed inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 30% 50%, transparent 0%, rgba(3,3,10,0.55) 55%, rgba(3,3,10,0.92) 100%)",
          }}
        />

        {/* UI overlay */}
        <div className="relative z-10 flex min-h-screen flex-col pointer-events-none">
          <nav className="pointer-events-auto flex items-center justify-between border-b border-white/[0.06] px-6 py-5 md:px-12">
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-white">
              <div className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-[#5B52FF]">
                <div className="h-[7px] w-[7px] animate-pulse rounded-full bg-[#5B52FF]" />
              </div>
              GLOBECLOUD
            </div>
            <div className="flex items-center gap-5 sm:gap-7">
              <a href="/api/docs" target="_blank" rel="noopener" className="text-xs text-white/30 no-underline hover:text-white/60">
                Docs
              </a>
              <Link to="/status" className="hidden sm:inline text-xs text-white/30 no-underline hover:text-white/60">
                Status
              </Link>
              <Link to="/login" onClick={enter} className="rounded-full border border-[var(--accent,#5B52FF)]/45 bg-[var(--accent-muted)] px-4 py-1.5 text-[11px] font-semibold text-[#8B85FF] no-underline">
                Sign in
              </Link>
            </div>
          </nav>

          <motion.div
            className="pointer-events-auto flex flex-1 flex-col justify-center px-6 py-12 md:px-12 md:py-16 max-w-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#5B52FF]/25 bg-[#5B52FF]/[0.06] px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#5B52FF]">
              <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#5B52FF]" />
              {product?.regions ?? 3}-region · {product?.deployment_mode ?? "local"}
            </div>
            <h1 className="mb-4 text-4xl font-light leading-[1.05] tracking-[-0.035em] text-white sm:text-5xl md:text-[56px]">
              Your data,
              <br />
              <em className="font-bold not-italic">everywhere</em>
              <br />
              <span className="text-[#5B52FF]">at once.</span>
            </h1>
            <p className="mb-8 max-w-md text-sm leading-[1.75] text-white/40">
              Replication across US, EU, and AP. Reads land on the nearest replica. Ask your docs in plain language.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/app"
                onClick={enter}
                className="inline-flex items-center gap-2 rounded-[9px] bg-[var(--accent,#5B52FF)] px-6 py-3 text-[13px] font-semibold text-white no-underline shadow-[0_0_40px_var(--accent-glow)]"
              >
                <Terminal className="h-4 w-4" /> Open console
              </Link>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener"
                className="rounded-[9px] border border-white/10 bg-black/20 px-6 py-3 text-[13px] text-white/45 no-underline backdrop-blur-sm"
              >
                Read the docs
              </a>
            </div>
          </motion.div>

          <div className="pointer-events-auto mt-auto grid grid-cols-3 border-t border-white/[0.06] bg-black/25 backdrop-blur-md">
            <div className="border-r border-white/[0.06] px-4 py-5 md:px-8">
              <div className="font-mono text-2xl font-medium tracking-[-0.03em] text-[#2DD4A0] md:text-[28px]">
                {avgMs ?? "—"}
                <span className="text-xs font-normal opacity-40">ms</span>
              </div>
              <div className="text-[10px] tracking-wide text-white/30 md:text-[11px]">avg read latency</div>
            </div>
            <div className="border-r border-white/[0.06] px-4 py-5 md:px-8">
              <div className="font-mono text-2xl font-medium tracking-[-0.03em] text-white md:text-[28px]">
                {sync?.interval_s ?? "—"}
                <span className="text-xs font-normal opacity-40">s</span>
              </div>
              <div className="text-[10px] tracking-wide text-white/30 md:text-[11px]">sync interval</div>
            </div>
            <div className="px-4 py-5 md:px-8">
              <div className="font-mono text-2xl font-medium tracking-[-0.03em] text-white md:text-[28px]">
                {product?.knowledge_docs ?? "—"}
                <span className="text-xs font-normal opacity-40"> docs</span>
              </div>
              <div className="text-[10px] tracking-wide text-white/30 md:text-[11px]">knowledge base</div>
            </div>
          </div>

          <div className="pointer-events-auto hidden border-t border-white/[0.06] bg-black/20 backdrop-blur-sm md:grid md:grid-cols-3">
            {[
              { icon: Route, name: "Route", desc: "Latency-aware region selection. Reads hit the closest healthy node.", mono: "→ geo_routing: true" },
              { icon: RefreshCw, name: "Replicate", desc: "Append-only logs sync across regions. Full audit trail.", mono: "→ multi_region: true" },
              { icon: MessageCircle, name: "Ask", desc: "Grounded RAG copilot answers from your docs with citations.", mono: `→ rag_agent: ${product?.llm_mode ?? "openai"}` },
            ].map(({ icon: Icon, name, desc, mono }, i) => (
              <div
                key={name}
                className={`px-6 py-5 md:px-8 ${i < 2 ? "md:border-r border-white/[0.06]" : ""}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-[#5B52FF]/30 text-[#7B75FF]">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/55">{name}</span>
                </div>
                <p className="text-xs leading-relaxed text-white/30">{desc}</p>
                <p className="mt-2 font-mono text-[10px] tracking-wider text-[#5B52FF]">{mono}</p>
              </div>
            ))}
          </div>

          <p className="pointer-events-auto border-t border-white/[0.06] py-4 text-center text-[11px] text-white/25">
            <Link to="/" onClick={enter} className="text-[#8B85FF] hover:underline">
              Continue to marketing site →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
