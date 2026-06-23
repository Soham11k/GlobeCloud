import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/Logo";
import { DotLabel } from "@/components/brand/DotLabel";
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

const HOW_IT_WORKS = [
  { n: "01", step: "route" as const, title: "Route", desc: "Probes regional health and picks the lowest-latency Postgres node per request." },
  { n: "02", step: "replicate" as const, title: "Replicate", desc: "Transactional outbox syncs catalog, orders, and knowledge docs across regions." },
  { n: "03", step: "ask" as const, title: "Agent", desc: "pgvector retrieval with citations from your docs — streamed when OpenAI is configured." },
];

const FAQ = [
  { q: "What regions are included?", a: "Starter and Pro include us-east-1, eu-west-1, and ap-south-1. Add an extra region for $29/month or contact us for custom topology." },
  { q: "Do I need an OpenAI key?", a: "No for basic use. Set OPENAI_API_KEY on the server for GPT-4o-mini with citation tracking and streaming responses." },
  { q: "How does replication handle conflicts?", a: "Stock updates use last-write-wins with a floor of zero. Orders and knowledge docs append via the transactional outbox without merge conflicts." },
  { q: "Can I deploy to production?", a: "Yes. Fly.io configs are included for a global gateway plus three regional Postgres backends. See docs/GETTING_STARTED.md." },
  { q: "Is the catalog customizable?", a: "Edit seed/catalog.json and run ./scripts/seed-production.sh. Products and knowledge docs load on first server start." },
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

  const mapHealthy = Object.fromEntries((metrics?.router ?? []).map((r) => [r.region_id, r.healthy]));
  const mapLatencies = Object.fromEntries((metrics?.router ?? []).map((r) => [r.region_id, r.latency_ms ?? 0]));

  return (
    <CinematicShell>
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border">
        <div className="dot-grid-bg pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
        <div className="section-wrap relative grid min-h-[min(88vh,780px)] lg:grid-cols-2">
          <div className="flex flex-col justify-center py-16 lg:py-24 lg:pr-12">
            <DotLabel className="mb-6">{deployLabel}</DotLabel>
            <h1 className="max-w-[14ch] text-[clamp(2.5rem,6vw,4.25rem)] font-medium leading-[1.05] tracking-[-0.04em]">
              Postgres routing across regions
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              Geo routing, outbox replication, and a cited RAG agent — one stack on Fly.io.
              Open the console without an account.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/app">Open console</Link>
              </Button>
              {!isAuthenticated && (
                <Button size="lg" variant="outline" asChild>
                  <Link to="/signup">Create account</Link>
                </Button>
              )}
            </div>
            <LiveStatBar
              className="mt-12"
              probes={mapProbes}
              loading={isLoading}
              syncInterval={sync?.interval_s}
              knowledgeDocs={product?.knowledge_docs}
            />
          </div>
          <div className="relative min-h-[40vh] lg:min-h-0">
            <GlobeScenePanel
              className="absolute inset-0 h-full w-full border-0 bg-transparent"
              height="100%"
              regions={regionsData?.regions}
              latencies={mapLatencies}
              healthy={mapHealthy}
              variant="hero"
            />
          </div>
        </div>
      </section>

      <section id="how" className="section-wrap py-20 md:py-28">
        <DotLabel>How it works</DotLabel>
        <h2 className="mt-4 text-3xl font-medium tracking-[-0.03em] md:text-4xl">Three systems</h2>
        <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.n} className="group">
              <span className="font-mono text-xs text-accent">{item.n}</span>
              <StepIllustration step={item.step} />
              <h3 className="mt-4 text-lg font-medium">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="proof" className="border-y border-border bg-muted/30 py-20 md:py-28">
        <div className="section-wrap grid items-center gap-12 lg:grid-cols-2">
          <div>
            <DotLabel>Console</DotLabel>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.03em]">Same API everywhere</h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Routing, replication, and agent panels all call <code className="text-foreground">/api/v1/*</code>.
              What you see in the UI is what you can script.
            </p>
          </div>
          <BrowserMock url="app.globecloud.dev">
            <ProductScreenshots />
          </BrowserMock>
        </div>
      </section>

      <section id="pricing" className="section-wrap py-20 md:py-28">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <DotLabel>Plans</DotLabel>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.03em]">Pricing</h2>
          </div>
          <div className="flex gap-1 p-1 bg-muted">
            <button
              type="button"
              className={cn("px-4 py-2 text-sm font-medium", !annual && "bg-background text-foreground")}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn("px-4 py-2 text-sm font-medium", annual && "bg-background text-foreground")}
              onClick={() => setAnnual(true)}
            >
              Annual −20%
            </button>
          </div>
        </div>

        {catalogLoading ? (
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 w-full" />)}
          </div>
        ) : plans.length === 0 ? (
          <p className="mt-12 text-muted-foreground">
            No catalog yet. Run <code>./scripts/seed-production.sh</code> and restart.
          </p>
        ) : (
          <>
            <div className="mt-12 grid gap-px bg-border md:grid-cols-3">
              {plans.map((plan) => {
                const tier = tierFromProduct(plan.id, plan.category);
                const price = annual ? Math.round(plan.price * 0.8) : plan.price;
                const featured = tier === "pro";
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex flex-col bg-background p-8",
                      featured && "md:-my-2 md:border-y md:border-accent md:py-10",
                    )}
                  >
                    {featured && <DotLabel className="mb-4">Recommended</DotLabel>}
                    <div className="flex items-start gap-3">
                      <PlanIcon tier={tier} />
                      <div>
                        <p className="text-lg font-medium">{plan.name}</p>
                        <p className="data-mono mt-0.5">{plan.sku}</p>
                      </div>
                    </div>
                    <p className="mt-6 text-4xl font-medium tracking-[-0.04em] tabular-nums">
                      ${price.toFixed(0)}
                      <span className="text-base font-normal text-muted-foreground">/mo</span>
                    </p>
                    {plan.description && (
                      <p className="mt-4 flex-1 text-sm text-muted-foreground">{plan.description}</p>
                    )}
                    <Button className="mt-8 w-full" variant={featured ? "default" : "outline"} asChild>
                      <Link to={isAuthenticated ? "/app" : "/signup"}>
                        {featured ? "Get started" : "Start free"}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
            {addons.length > 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {addons.map((addon) => (
                  <div key={addon.id} className="console-panel flex gap-4 p-5">
                    <PlanIcon tier="addon" className="h-10 w-10 shrink-0" />
                    <div>
                      <p className="font-medium">{addon.name}</p>
                      <p className="mt-1 text-xl tabular-nums tracking-[-0.03em]">
                        ${(annual ? Math.round(addon.price * 0.8) : addon.price).toFixed(0)}/mo
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="mt-10 flex flex-wrap gap-3">
          <Button variant="outline" asChild><Link to="/app/catalog">Inventory</Link></Button>
          <Button variant="ghost" asChild><a href="/api/docs">API docs</a></Button>
        </div>
      </section>

      <section className="section-wrap border-t border-border py-20">
        <DotLabel>FAQ</DotLabel>
        <h2 className="mt-4 text-2xl font-medium">Questions</h2>
        <div className="mt-10 max-w-2xl divide-y divide-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="cursor-pointer list-none text-base font-medium marker:content-none [&::-webkit-details-marker]:hidden">
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

      <footer className="border-t border-border">
        <div className="section-wrap grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo showWordmark className="mb-4" />
            <p className="text-sm text-muted-foreground">Multi-region Postgres routing.</p>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/app" className="hover:text-foreground">Console</Link></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><Link to="/status" className="hover:text-foreground">Status</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Developers</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/api/docs" className="hover:text-foreground">API reference</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Contact</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="mailto:hello@globecloud.dev" className="hover:text-foreground">hello@globecloud.dev</a></li>
            </ul>
          </div>
        </div>
        <div className="section-wrap border-t border-border py-6 text-xs text-muted-foreground">
          {health && <p>{health.status === "ok" ? "All systems operational" : "Degraded"} · GlobeCloud</p>}
        </div>
      </footer>
    </CinematicShell>
  );
}
