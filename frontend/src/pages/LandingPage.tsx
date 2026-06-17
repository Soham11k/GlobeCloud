import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/Logo";
import { ProductScreenshots } from "@/components/brand/ProductScreenshots";
import { StepIllustration } from "@/components/brand/StepIllustration";
import { GlobeMap } from "@/components/GlobeMap";
import { ProductShell } from "@/components/layout/ProductShell";
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
  { step: "route" as const, title: "Geo routing", desc: "Probes regional health and picks the lowest-latency node for each request." },
  { step: "replicate" as const, title: "Replication", desc: "Append-only logs sync products, orders, and knowledge docs across regional SQLite files." },
  { step: "ask" as const, title: "Cited copilot", desc: "TF-IDF retrieval grounds answers in your docs with confidence scores." },
];

const FAQ = [
  {
    q: "What regions are included?",
    a: "Starter and Pro include us-east-1, eu-west-1, and ap-south-1. Add an extra region for $29/month or contact us for custom topology.",
  },
  {
    q: "Do I need an OpenAI key?",
    a: "No. Copilot works with a local heuristic fallback. Set OPENAI_API_KEY on the server for GPT-4o-mini with citation tracking.",
  },
  {
    q: "How does replication handle conflicts?",
    a: "Stock updates use last-write-wins with a floor of zero. Orders and knowledge docs append without merge conflicts.",
  },
  {
    q: "Can I deploy to production?",
    a: "Yes. Fly.io configs are included for a global gateway plus three regional backends. See docs/GETTING_STARTED.md.",
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

  return (
    <ProductShell>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[var(--surface-0)]/80 backdrop-blur-md">
        <div className="section-wrap flex items-center justify-between h-14">
          <Logo />
          <nav className="hidden sm:flex items-center gap-6 text-sm text-white/50">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link to="/status" className="hover:text-white transition-colors">Status</Link>
            <a href="/api/docs" target="_blank" rel="noopener" className="hover:text-white transition-colors">Docs</a>
          </nav>
          <div className="flex gap-2">
            {!isAuthenticated && (
              <Button variant="ghost" size="sm" className="text-white/70" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link to="/app">
                Open console <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative min-h-[min(88vh,720px)] flex flex-col">
        <div className="absolute inset-0">
          <GlobeMap
            regions={regionsData?.regions}
            probes={mapProbes}
            interactive
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-[var(--surface-0)]/40 to-transparent pointer-events-none" />
        </div>

        <div className="relative z-10 section-wrap flex flex-1 flex-col justify-end pb-12 pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl"
          >
            <Badge variant="accent" className="mb-4 font-mono text-[10px]">
              {deployLabel}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-semibold leading-[1.08] tracking-tight text-white">
              Route globally.
              <br />
              <span className="text-[var(--accent,#5b52ff)]">Operate locally.</span>
            </h1>
            <p className="mt-4 text-base text-white/55 max-w-md leading-relaxed">
              Live geo routing, multi-region replication, and a cited copilot — explore the console instantly, sign in when you need to write.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/app">Open console</Link>
              </Button>
              {!isAuthenticated && (
                <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" asChild>
                  <Link to="/signup">Create account</Link>
                </Button>
              )}
            </div>
          </motion.div>

          <div className="mt-10 flex flex-wrap gap-2">
            {isLoading
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-28 bg-white/10" />)
              : mapProbes.map((r) => (
                  <Badge
                    key={r.region_id}
                    variant={r.healthy ? "success" : "danger"}
                    className="font-mono text-[11px] bg-black/40 backdrop-blur-sm"
                  >
                    {r.region_id} · {r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : "—"}
                  </Badge>
                ))}
            {sync?.interval_s != null && (
              <Badge variant="default" className="font-mono text-[11px] bg-black/40 backdrop-blur-sm">
                sync {sync.interval_s}s
              </Badge>
            )}
            {product?.knowledge_docs != null && (
              <Badge variant="default" className="font-mono text-[11px] bg-black/40 backdrop-blur-sm">
                {product.knowledge_docs} docs
              </Badge>
            )}
          </div>
        </div>
      </section>

      <section id="how" className="section-wrap py-20 md:py-24 border-t border-white/5">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white">How it works</h2>
          <p className="mt-3 text-white/50">
            Three steps from client request to cited answer — no generic middleware stack.
          </p>
        </div>
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
              <h3 className="font-medium text-white">{item.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="proof" className="section-wrap py-20 md:py-24 border-t border-white/5">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">Live console data</h2>
            <p className="mt-3 text-white/50 max-w-md">
              Routing, replication, and copilot panels read from the same API as /app.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
            <ProductScreenshots />
          </div>
        </div>
      </section>

      <section id="pricing" className="section-wrap py-20 md:py-24 border-t border-white/5 bg-[var(--surface-1)]/50">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">Catalog</h2>
            <p className="mt-2 text-white/50">
              Plans loaded from your database ({catalog?.products_total ?? "—"} products, {catalog?.knowledge_docs ?? "—"} docs).
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span className={!annual ? "font-medium text-white" : ""}>Monthly</span>
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
            <span className={annual ? "font-medium text-white" : ""}>Annual (−20%)</span>
          </div>
        </div>

        {catalogLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full bg-white/5" />)}
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-white/50 border border-white/10 rounded-xl p-6">
            No catalog products. Run <code className="text-xs">./scripts/seed-production.sh</code> and restart.
          </p>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const tier = tierFromProduct(plan.id, plan.category);
                const price = annual ? Math.round(plan.price * 0.8) : plan.price;
                return (
                  <div key={plan.id} className="rounded-xl border border-white/10 bg-[var(--surface-0)] p-5 flex flex-col">
                    <div className="flex gap-3 items-start mb-4">
                      <PlanIcon tier={tier} />
                      <div>
                        <p className="font-semibold text-white">{plan.name}</p>
                        <p className="text-xs text-white/40 font-mono">{plan.sku}</p>
                      </div>
                    </div>
                    <p className="text-3xl font-semibold tabular-nums text-white">
                      ${price.toFixed(0)}
                      <span className="text-sm font-normal text-white/40">/mo</span>
                    </p>
                    {plan.description && (
                      <p className="mt-3 text-sm text-white/50 flex-1 leading-relaxed">{plan.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {addons.length > 0 && (
              <div className="mt-8 grid sm:grid-cols-3 gap-3">
                {addons.map((addon) => (
                  <div key={addon.id} className="rounded-lg border border-white/10 bg-[var(--surface-0)] p-4 flex gap-3">
                    <PlanIcon tier="addon" className="h-10 w-10 shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-white">{addon.name}</p>
                      <p className="text-lg font-semibold tabular-nums text-white mt-0.5">
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
          <Button variant="outline" className="border-white/15 text-white" asChild>
            <a href="/api/docs">Read API docs</a>
          </Button>
        </div>
      </section>

      <section className="section-wrap py-20 border-t border-white/5">
        <h2 className="text-3xl font-semibold tracking-tight text-white mb-10">FAQ</h2>
        <dl className="space-y-6 max-w-3xl">
          {FAQ.map((item) => (
            <div key={item.q} className="border-b border-white/10 pb-6 last:border-0">
              <dt className="font-medium text-white">{item.q}</dt>
              <dd className="mt-2 text-sm text-white/50 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-white/5 bg-[var(--surface-1)]">
        <div className="section-wrap py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <Logo showWordmark className="mb-3" />
            <p className="text-white/40 text-xs">Global SQLite routing platform.</p>
          </div>
          <div>
            <p className="font-medium mb-3 text-white">Product</p>
            <ul className="space-y-2 text-white/50">
              <li><Link to="/app" className="hover:text-white">Console</Link></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><Link to="/status" className="hover:text-white">Status</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-3 text-white">Developers</p>
            <ul className="space-y-2 text-white/50">
              <li><a href="/api/docs" className="hover:text-white">API reference</a></li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-3 text-white">Company</p>
            <ul className="space-y-2 text-white/50">
              <li><a href="mailto:hello@globecloud.dev" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="section-wrap pb-8 text-xs text-white/35 text-center">
          {health && <p>System {health.status === "ok" ? "operational" : "degraded"} · GlobeCloud</p>}
        </div>
      </footer>
    </ProductShell>
  );
}
