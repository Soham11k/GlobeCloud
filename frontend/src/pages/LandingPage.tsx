import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/Logo";
import { BrowserMock } from "@/components/brand/BrowserMock";
import { ConsolePreview } from "@/components/brand/ConsolePreview";
import { ProductScreenshots } from "@/components/brand/ProductScreenshots";
import { StepIllustration } from "@/components/brand/StepIllustration";
import { useProduct, useHealth, useMetrics, useGlobalStatus, useCatalog } from "@/lib/hooks";
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
  const isGateway = product?.deployment_mode === "gateway";
  const { data: fleet } = useGlobalStatus(!!isGateway);
  const [annual, setAnnual] = useState(false);

  const regions = fleet?.regions ?? metrics?.router ?? [];
  const plans = catalog?.plans ?? [];
  const addons = catalog?.addons ?? [];

  return (
    <div className="min-h-screen page-shell">
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="section-wrap flex items-center justify-between h-14">
          <Logo />
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link to="/status" className="hover:text-foreground transition-colors">Status</Link>
            <a href="/api/docs" target="_blank" rel="noopener" className="hover:text-foreground transition-colors">Docs</a>
          </nav>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link to="/status">Status</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/app">Open console <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {product?.is_simulated && (
        <div className="border-b border-border bg-muted/40">
          <p className="section-wrap py-2.5 text-xs text-muted-foreground text-center">
            {product.simulation_note} · {product.catalog_products ?? 0} catalog products · {product.knowledge_docs ?? 0} knowledge docs loaded
          </p>
        </div>
      )}

      <section className="section-wrap pt-16 pb-20 md:pt-24">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-sm font-medium text-accent mb-4">Multi-region SQLite platform</p>
            <h1 className="text-4xl md:text-[3rem] font-semibold leading-[1.1] tracking-tight">
              One console for routing, replication, and{" "}
              <span className="headline-accent">grounded AI</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg">
              Route to the nearest healthy region. Replicate inventory across SQLite peers. Ask the copilot — answers cite your knowledge base.
            </p>
            {product && (
              <p className="mt-3 text-sm text-muted-foreground">
                {product.regions} regions · {product.deployment_mode}
                {product.is_simulated ? " (single-host)" : ""} · {product.llm_mode} LLM
                {product.catalog_products != null && ` · ${product.catalog_products} products`}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/app">Open console</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#proof">See product</a>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <BrowserMock url={`${window.location.host}/app`}>
              <ConsolePreview />
            </BrowserMock>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="section-wrap py-8">
          <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-widest font-medium">
            Live fleet
          </p>
          {isLoading ? (
            <div className="flex justify-center gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-32" />)}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {regions.map((r) => (
                <Badge
                  key={r.region_id}
                  variant={r.healthy !== false ? "success" : "danger"}
                  className="px-4 py-2 text-sm font-mono"
                >
                  {r.region_id} · {r.latency_ms ?? "—"} ms
                </Badge>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="how" className="section-wrap py-20 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-3 text-muted-foreground">
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
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="proof" className="section-wrap py-20 md:py-24 border-t border-border">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Live console data</h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              Routing, replication, and copilot panels below read from the same API as /app — refresh the page to see current state.
            </p>
          </div>
          <BrowserMock url={`${window.location.host}/app`}>
            <ProductScreenshots />
          </BrowserMock>
        </div>
      </section>

      <section id="pricing" className="section-wrap py-20 md:py-24 border-t border-border bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Catalog</h2>
            <p className="mt-2 text-muted-foreground">
              Plans and add-ons loaded from your database ({catalog?.products_total ?? "—"} products, {catalog?.knowledge_docs ?? "—"} docs).
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={!annual ? "font-medium" : "text-muted-foreground"}>Monthly</span>
            <button
              type="button"
              className="relative w-11 h-6 rounded-full bg-border transition-colors"
              onClick={() => setAnnual(!annual)}
              aria-label="Toggle annual pricing"
            >
              <motion.span
                className="absolute top-1 left-1 h-4 w-4 rounded-full bg-accent"
                animate={{ x: annual ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={annual ? "font-medium" : "text-muted-foreground"}>Annual (−20%)</span>
          </div>
        </div>

        {catalogLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-xl p-6 bg-card">
            No catalog products in the database. Run <code className="text-xs">./scripts/seed-production.sh</code> and restart the server.
          </p>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const tier = tierFromProduct(plan.id, plan.category);
                const price = annual ? Math.round(plan.price * 0.8) : plan.price;
                return (
                  <div key={plan.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                    <div className="flex gap-3 items-start mb-4">
                      <PlanIcon tier={tier} />
                      <div>
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{plan.sku}</p>
                      </div>
                    </div>
                    <p className="text-3xl font-semibold tabular-nums">
                      ${price.toFixed(0)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    {plan.description && (
                      <p className="mt-3 text-sm text-muted-foreground flex-1 leading-relaxed">{plan.description}</p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">{plan.stock} available · order in Inventory</p>
                  </div>
                );
              })}
            </div>
            {addons.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Add-ons</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {addons.map((addon) => (
                    <div key={addon.id} className="rounded-lg border border-border bg-card p-4 flex gap-3 items-start">
                      <PlanIcon tier="addon" className="h-10 w-10 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{addon.name}</p>
                        <p className="text-lg font-semibold tabular-nums mt-0.5">
                          ${(annual ? Math.round(addon.price * 0.8) : addon.price).toFixed(0)}/mo
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{addon.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild><Link to="/app/inventory">View in Inventory</Link></Button>
          <Button variant="outline" asChild><a href="/api/docs">Read API docs</a></Button>
        </div>
      </section>

      <section className="section-wrap py-20 md:py-24 border-t border-border">
        <h2 className="text-3xl font-semibold tracking-tight mb-10">FAQ</h2>
        <dl className="space-y-6 max-w-3xl">
          {FAQ.map((item) => (
            <div key={item.q} className="border-b border-border pb-6 last:border-0">
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-border bg-muted/30">
        <div className="section-wrap py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <Logo showWordmark className="mb-3" />
            <p className="text-muted-foreground text-xs">Global SQLite routing platform.</p>
          </div>
          <div>
            <p className="font-medium mb-3">Product</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to="/app" className="hover:text-foreground">Console</Link></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><Link to="/status" className="hover:text-foreground">Status</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-3">Developers</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="/api/docs" className="hover:text-foreground">API reference</a></li>
              <li><a href="/api/docs" className="hover:text-foreground">OpenAPI</a></li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-3">Company</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="mailto:hello@globecloud.dev" className="hover:text-foreground">Contact</a></li>
              <li><span className="opacity-60">Privacy</span></li>
              <li><span className="opacity-60">Terms</span></li>
            </ul>
          </div>
        </div>
        <div className="section-wrap pb-8 text-xs text-muted-foreground text-center">
          {health && <p>System {health.status === "ok" ? "operational" : "degraded"} · GlobeCloud</p>}
        </div>
      </footer>
    </div>
  );
}
