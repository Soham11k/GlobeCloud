import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Globe2,
  Route,
  RefreshCw,
  Bot,
  ArrowRight,
  Zap,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobeMap } from "@/components/GlobeMap";
import { Globe3DLazy } from "@/components/Globe3DLazy";
import { useProduct, useHealth, useMetrics, useGlobalStatus } from "@/lib/hooks";
import { fadeUp, staggerContainer } from "@/lib/motion";

const FEATURES = [
  { icon: Route, title: "Global routing", desc: "Latency-aware region selection with health probes and circuit breakers." },
  { icon: RefreshCw, title: "Multi-region sync", desc: "Replication logs keep inventory and knowledge aligned across regions." },
  { icon: Bot, title: "Grounded copilot", desc: "Plain-English answers with citations and confidence scoring." },
];

export function LandingPage() {
  const { data: product } = useProduct();
  const { data: health } = useHealth();
  const { data: metrics, isLoading } = useMetrics();
  const isGateway = product?.deployment_mode === "gateway";
  const { data: fleet } = useGlobalStatus(!!isGateway);
  const [annual, setAnnual] = useState(false);

  const regions = fleet?.regions ?? metrics?.router ?? [];

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <Globe2 className="h-6 w-6 text-accent" />
          Globe<span className="text-accent">Cloud</span>
        </Link>
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/status">Status</Link></Button>
          <Button variant="ghost" asChild><a href="/api/docs" target="_blank" rel="noopener">API</a></Button>
          <Button asChild><Link to="/app">Open console <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="accent" className="mb-4">Global database platform</Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Run a <span className="text-gradient">multi-region database</span> from one console
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Route requests to US, EU, or AP. Sync SQLite replicas. Ask the copilot — answers include sources.
            </p>
            {product && (
              <p className="mt-3 text-sm text-muted-foreground">
                {product.regions} regions · {product.deployment_mode} · {product.llm_mode} LLM
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link to="/app">Open console →</Link></Button>
              <Button size="lg" variant="secondary" asChild><a href="#features">Features</a></Button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl overflow-hidden border border-border/50 shadow-2xl bg-card/30"
          >
            <Globe3DLazy className="h-72 w-full" />
          </motion.div>
        </div>

        <motion.div
          className="mt-12 rounded-xl overflow-hidden border border-border/50"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <GlobeMap
            probes={regions.map((r) => ({ region_id: r.region_id, healthy: r.healthy !== false }))}
            className="w-full h-48 md:h-56"
          />
        </motion.div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-8 border-y border-border/50 bg-card/20">
        <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-wider">Live fleet</p>
        {isLoading ? (
          <div className="flex justify-center gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-36" />)}</div>
        ) : (
          <motion.div className="flex flex-wrap justify-center gap-3" variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }}>
            {regions.map((r) => (
              <motion.div key={r.region_id} variants={fadeUp}>
                <Badge variant={r.healthy !== false ? "success" : "danger"} className="px-4 py-2 text-sm">
                  {r.region_id} · {r.latency_ms ?? "—"} ms
                </Badge>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold text-center mb-10">Built for global scale</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader>
                  <f.icon className="h-8 w-8 text-accent mb-2" />
                  <CardTitle>{f.title}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{f.desc}</p></CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={!annual ? "font-medium" : "text-muted-foreground"}>Monthly</span>
          <button
            type="button"
            className="relative w-12 h-6 rounded-full bg-muted transition-colors"
            onClick={() => setAnnual(!annual)}
            aria-label="Toggle annual pricing"
          >
            <motion.span
              className="absolute top-1 left-1 h-4 w-4 rounded-full bg-accent"
              animate={{ x: annual ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 400 }}
            />
          </button>
          <span className={annual ? "font-medium" : "text-muted-foreground"}>Annual (save 20%)</span>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-accent" /> Developer</CardTitle>
              <p className="text-3xl font-bold">${annual ? "0" : "0"}</p>
              <p className="text-sm text-muted-foreground">Self-hosted</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>✓ 3 regional nodes</p>
              <p>✓ Geo routing + metrics history</p>
              <p>✓ RAG agent (OpenAI optional)</p>
              <Button className="w-full mt-4" asChild><Link to="/app">Get started</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Production</CardTitle>
              <p className="text-3xl font-bold">Custom</p>
              <p className="text-sm text-muted-foreground">Deploy on Fly.io</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>✓ Global gateway + 3 regions</p>
              <p>✓ Audit logs + activity feed</p>
              <p>✓ API key + replication auth</p>
              <Button variant="secondary" className="w-full mt-4" asChild><a href="/api/docs">View API</a></Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-6 text-center text-sm text-muted-foreground">
        <Link to="/app" className="text-accent hover:underline">Console</Link>
        {" · "}
        <Link to="/status" className="hover:underline">Status</Link>
        {" · "}
        <a href="/api/docs" className="hover:underline">API Docs</a>
        {health && <p className="mt-2 text-xs">System {health.status === "ok" ? "operational" : "degraded"}</p>}
      </footer>
    </div>
  );
}
