import { Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/Logo";
import { ProductScreenshots } from "@/components/brand/ProductScreenshots";
import { StepIllustration } from "@/components/brand/StepIllustration";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteHeader } from "@/components/layout/SiteHeader";
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
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { useMotionPrefs } from "@/lib/useMotionPrefs";

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
  const { reducedMotion } = useMotionPrefs();
  const motionProps = reducedMotion ? {} : { initial: "initial", whileInView: "animate", viewport: { once: true, margin: "-40px" } };

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

      <section className="relative flex min-h-[min(88vh,820px)] flex-col sm:min-h-[min(94vh,860px)]">
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
            className="max-w-lg console-panel p-6 md:p-8"
            variants={fadeUp}
            initial={reducedMotion ? false : "initial"}
            animate={reducedMotion ? undefined : "animate"}
            transition={{ duration: 0.35 }}
          >
            <Badge variant="accent" className="mb-4 font-mono text-[10px]">
              {deployLabel}
            </Badge>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
              Multi-region Postgres routing on Fly.io
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Geo routing via <code className="font-mono text-xs">POST /api/v1/route</code>, transactional outbox
              replication, and a pgvector RAG agent. Open the console without signing in.
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
        <div className="mb-10">
          <p className="font-mono text-xs text-muted-foreground">architecture</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Gateway probes regional Postgres peers and routes writes through the outbox.
          </p>
        </div>
        <motion.div
          className="mt-12 grid gap-8 md:grid-cols-3"
          variants={staggerContainer}
          {...motionProps}
        >
          {HOW_IT_WORKS.map((item) => (
            <motion.div key={item.title} className="space-y-3" variants={fadeUp}>
              <StepIllustration step={item.step} />
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section id="proof" className="section-wrap border-t border-border py-20 md:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {product?.deployment_mode ?? "regional"} · {regionsData?.regions.length ?? "—"} regions
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Console uses the same API</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Routing, replication, and agent panels read from <code className="font-mono text-xs">/api/v1/*</code>.
            </p>
          </div>
          <BrowserMock url="app.globecloud.dev">
            <ProductScreenshots />
          </BrowserMock>
        </div>
      </section>

      <section id="pricing" className="section-wrap border-t border-border bg-muted/20 py-20 md:py-24">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground">catalog · {catalog?.products_total ?? "—"} products</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Plans & add-ons</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Loaded from Postgres ({catalog?.knowledge_docs ?? "—"} knowledge docs).
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={!annual ? "font-medium text-foreground" : ""}>Monthly</span>
            <button
              type="button"
              className="relative h-6 w-11 rounded-full bg-muted transition-colors"
              onClick={() => setAnnual(!annual)}
              aria-label="Toggle annual pricing"
            >
              <span
                className="absolute top-1 left-1 h-4 w-4 rounded-full bg-accent transition-transform"
                style={{ transform: annual ? "translateX(20px)" : "translateX(0)" }}
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
          <p className="console-panel p-6 text-sm text-muted-foreground">
            No catalog products. Run <code className="text-xs">./scripts/seed-production.sh</code> and restart.
          </p>
        ) : (
          <>
            <motion.div
              className="grid gap-4 md:grid-cols-3"
              variants={staggerContainer}
              {...motionProps}
            >
              {plans.map((plan) => {
                const tier = tierFromProduct(plan.id, plan.category);
                const price = annual ? Math.round(plan.price * 0.8) : plan.price;
                return (
                  <motion.div
                    key={plan.id}
                    variants={fadeUp}
                    className={cn(
                      "console-panel flex flex-col p-5",
                      tier === "pro" && "ring-1 ring-accent/40"
                    )}
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
                    <Button className="mt-4 w-full" variant={tier === "pro" ? "default" : "outline"} asChild>
                      <Link to={isAuthenticated ? "/app" : "/signup"}>
                        {tier === "pro" ? "Get started" : "Start free"}
                      </Link>
                    </Button>
                  </motion.div>
                );
              })}
            </motion.div>
            {addons.length > 0 && (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {addons.map((addon) => (
                  <div key={addon.id} className="console-panel flex gap-3 p-4">
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
        <h2 className="mb-10 text-2xl font-semibold tracking-tight">FAQ</h2>
        <div className="max-w-3xl divide-y divide-border/60">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
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
