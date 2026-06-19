import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/Logo";
import { ProductScreenshots } from "@/components/brand/ProductScreenshots";
import { StepIllustration } from "@/components/brand/StepIllustration";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LiveStatBar } from "@/components/layout/LiveStatBar";
import { GlobeScenePanel } from "@/components/globe/GlobeScenePanel";
import { BrowserMock } from "@/components/brand/BrowserMock";
import {
  useProduct,
  useHealth,
  useMetrics,
  useCatalog,
  useRegions,
  useSyncStatus,
} from "@/lib/hooks";
import { useAuth } from "@/lib/useAuth";
import { PlanIcon, tierFromProduct } from "@/components/brand/PlanIcon";

const HOW_IT_WORKS = [
  { step: "route" as const, title: "Geo routing", desc: "Probes regional health and picks the lowest-latency PostgreSQL node for each request." },
  { step: "replicate" as const, title: "Replication", desc: "Transactional outbox syncs products, orders, and knowledge docs across regional Postgres clusters." },
  { step: "ask" as const, title: "Cited agent", desc: "pgvector retrieval grounds answers in your docs with OpenAI streaming and confidence scores." },
];

const FAQ = [
  {
    q: "What regions are included?",
    a: "Starter and Pro include us-east-1, eu-west-1, and ap-south-1. Add an extra region for $29/month or contact us for custom topology.",
  },
  {
    q: "Do I need an OpenAI key?",
    a: "No for basic use. Set OPENAI_API_KEY on the server for GPT-4o-mini with citation tracking and streaming responses.",
  },
  {
    q: "How does replication handle conflicts?",
    a: "Stock updates use last-write-wins with a floor of zero. Orders and knowledge docs append via the transactional outbox without merge conflicts.",
  },
  {
    q: "Can I deploy to production?",
    a: "Yes. Fly.io configs are included for a global gateway plus three regional Postgres backends. See docs/GETTING_STARTED.md.",
  },
  {
    q: "Is the catalog customizable?",
    a: "Edit seed/catalog.json and run ./scripts/seed-production.sh. Products and knowledge docs load on first server start.",
  },
];

export function LandingPage() {
  const { data: product } = useProduct();
  const { data: health } = useHealth();
  const { data: metrics, isLoading } = useMetrics();
  const { data: catalog, isLoading: catalogLoading } = useCatalog();
  const { data: regionsData } = useRegions();
  const { data: sync } = useSyncStatus();
  const { isAuthenticated } = useAuth();
  const [annual, setAnnual] = useState(false);

  const plans = catalog?.plans ?? [];
  const addons = catalog?.addons ?? [];
  const deployLabel =
    product?.deployment_mode === "gateway"
      ? "Live fleet"
      : product?.is_simulated
        ? "Local fleet"
        : product?.deployment_mode ?? "local";

  const mapProbes =
    metrics?.router.map((r) => ({
      region_id: r.region_id,
      healthy: r.healthy,
      latency_ms: r.latency_ms,
    })) ?? [];

  const mapHealthy = Object.fromEntries(
    (metrics?.router ?? []).map((r) => [r.region_id, r.healthy])
  );
  const mapLatencies = Object.fromEntries(
    (metrics?.router ?? []).map((r) => [r.region_id, r.latency_ms ?? 0])
  );

  return (
    <CinematicShell>
      <SiteHeader />

      <section className="relative flex min-h-[min(94vh,860px)] flex-col">
        <div className="absolute inset-0">
          <GlobeScenePanel
            className="h-full w-full rounded-none border-0"
            height="100%"
            regions={regionsData?.regions}
            latencies={mapLatencies}
            healthy={mapHealthy}
            variant="hero"
          />
          {/* Left vignette for copy legibility — keep the globe large on the right */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/95 via-background/45 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 section-wrap flex flex-1 flex-col justify-end pb-14 pt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md glass-panel p-6 md:max-w-lg md:p-8"
          >
            <Badge variant="accent" className="mb-4 font-mono text-[10px]">
              {deployLabel}
            </Badge>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-foreground md:text-5xl">
              Route globally.
              <br />
              <span className="text-accent">Operate locally.</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Live geo routing, multi-region replication, and a cited copilot — explore the console instantly, sign in when you need to write.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/app">Open console</Link>
              </Button>
              {!isAuthenticated && (
                <Button size="lg" variant="outline" asChild>
                  <Link to="/signup">Create account</Link>
                </Button>
              )}
            </div>
          </motion.div>

          <LiveStatBar
            className="mt-10"
            probes={mapProbes}
            loading={isLoading}
            syncInterval={sync?.interval_s}
            knowledgeDocs={product?.knowledge_docs}
          />
        </div>
      </section>

      <section id="how" className="section-wrap border-t border-border py-20 md:py-24">
        <SectionHeader
          eyebrow="Architecture"
          title="How it works"
          description="Three steps from client request to cited answer — no generic middleware stack."
        />
        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="space-y-3"
            >
              <StepIllustration step={item.step} />
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="proof" className="section-wrap border-t border-border py-20 md:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <SectionHeader
            eyebrow="Live data"
            title="Live console data"
            description="Routing, replication, and copilot panels read from the same API as /app."
          />
          <BrowserMock url="app.globecloud.dev">
            <ProductScreenshots />
          </BrowserMock>
        </div>
      </section>

      <section id="pricing" className="section-wrap border-t border-border bg-muted/20 py-20 md:py-24">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            eyebrow="Catalog"
            title="Plans & add-ons"
            description={`Plans loaded from your database (${catalog?.products_total ?? "—"} products, ${catalog?.knowledge_docs ?? "—"} docs).`}
          />
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={!annual ? "font-medium text-foreground" : ""}>Monthly</span>
            <button
              type="button"
              className="relative w-11 h-6 rounded-full bg-white/10 transition-colors"
              onClick={() => setAnnual(!annual)}
              aria-label="Toggle annual pricing"
            >
              <motion.span
                className="absolute top-1 left-1 h-4 w-4 rounded-full bg-[var(--accent)]"
                animate={{ x: annual ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={annual ? "font-medium text-foreground" : ""}>Annual (−20%)</span>
          </div>
        </div>

        {catalogLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full bg-muted/30" />)}
          </div>
        ) : plans.length === 0 ? (
          <p className="glass-panel p-6 text-sm text-muted-foreground">
            No catalog products. Run <code className="text-xs">./scripts/seed-production.sh</code> and restart.
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const tier = tierFromProduct(plan.id, plan.category);
                const price = annual ? Math.round(plan.price * 0.8) : plan.price;
                return (
                  <div
                    key={plan.id}
                    className={`glass-panel flex flex-col p-5 ${tier === "pro" ? "glow-ring border-accent/30" : ""}`}
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <PlanIcon tier={tier} />
                      <div>
                        <p className="font-semibold text-foreground">{plan.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{plan.sku}</p>
                      </div>
                    </div>
                    <p className="text-3xl font-semibold tabular-nums text-foreground">
                      ${price.toFixed(0)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    {plan.description && (
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {addons.length > 0 && (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {addons.map((addon) => (
                  <div key={addon.id} className="glass-panel flex gap-3 p-4">
                    <PlanIcon tier="addon" className="h-10 w-10 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{addon.name}</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                        ${(annual ? Math.round(addon.price * 0.8) : addon.price).toFixed(0)}/mo
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild><Link to="/app/catalog">View in Inventory</Link></Button>
          <Button variant="outline" asChild>
            <a href="/api/docs">Read API docs</a>
          </Button>
        </div>
      </section>

      <section className="section-wrap border-t border-border py-20">
        <SectionHeader title="FAQ" className="mb-10" />
        <dl className="max-w-3xl space-y-6">
          {FAQ.map((item) => (
            <div key={item.q} className="border-b border-border/60 pb-6 last:border-0">
              <dt className="font-medium text-foreground">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-border bg-muted/10">
        <div className="section-wrap grid gap-8 py-12 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo showWordmark className="mb-3" />
            <p className="text-xs text-muted-foreground">Global PostgreSQL routing platform.</p>
          </div>
          <div>
            <p className="mb-3 font-medium text-foreground">Product</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to="/app" className="hover:text-foreground">Console</Link></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><Link to="/status" className="hover:text-foreground">Status</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-medium text-foreground">Developers</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="/api/docs" className="hover:text-foreground">API reference</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-medium text-foreground">Company</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="mailto:hello@globecloud.dev" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="section-wrap pb-8 text-center text-xs text-muted-foreground">
          {health && <p>System {health.status === "ok" ? "operational" : "degraded"} · GlobeCloud</p>}
        </div>
      </footer>
    </CinematicShell>
  );
}
