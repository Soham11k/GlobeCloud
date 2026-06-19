import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Briefcase, ChevronDown, Code2, Globe2, Network } from "lucide-react";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { GlobeScene3DLazy } from "@/components/globe/GlobeScene3DLazy";
import { LivePingRail } from "@/components/layout/LivePingRail";
import { AuthOAuth } from "@/components/auth/AuthOAuth";
import { useLiveMetrics, useProduct, useRegions } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const RAIL_LINKS = [
  { to: "/", icon: Globe2, label: "Home" },
  { to: "/status", icon: Network, label: "Status" },
  { to: "/api/docs", icon: Code2, label: "API docs", external: true },
  { to: "/app", icon: Briefcase, label: "Console" },
] as const;

type AuthMode = "login" | "signup" | "plain";

type Props = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  mode?: AuthMode;
  footer?: ReactNode;
  showOAuth?: boolean;
  inviteToken?: string;
};

function AuthTabs({ mode }: { mode: "login" | "signup" }) {
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next");
  const nextQ = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="auth-tabs mb-8 grid grid-cols-2 gap-2">
      <Link
        to={`/login${nextQ}`}
        className={cn("auth-tab", mode === "login" && "auth-tab-active")}
      >
        Sign in
      </Link>
      <Link
        to={`/signup${nextQ}`}
        className={cn("auth-tab", mode === "signup" && "auth-tab-active")}
      >
        Register
      </Link>
    </div>
  );
}

function AuthHero() {
  const { data: regions } = useRegions();
  const { data: metrics } = useLiveMetrics();
  const { data: product } = useProduct();

  const healthyCount = metrics?.router.filter((r) => r.healthy).length ?? 0;
  const regionTotal = regions?.regions.length ?? metrics?.router.length ?? 0;
  const docs = product?.knowledge_docs ?? 0;
  const uptime =
    metrics?.router.length && healthyCount === metrics.router.length
      ? "99.9%"
      : metrics?.router.length
        ? `${Math.round((healthyCount / metrics.router.length) * 1000) / 10}%`
        : "—";

  const latencies = Object.fromEntries(
    (metrics?.router ?? [])
      .filter((r) => r.latency_ms != null)
      .map((r) => [r.region_id, r.latency_ms as number])
  );
  const healthyMap = Object.fromEntries((metrics?.router ?? []).map((r) => [r.region_id, r.healthy]));

  return (
    <section className="relative flex flex-1 flex-col justify-center overflow-hidden px-8 py-14 lg:px-14 xl:px-20">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden>
        <GlobeScene3DLazy
          className="h-full w-full"
          variant="ambient"
          regions={regions?.regions}
          latencies={latencies}
          healthy={healthyMap}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--space-bg)] via-[var(--space-bg)]/85 to-[var(--space-bg)]/40" />
      </div>

      <div className="relative z-10 max-w-xl">
        <p className="auth-eyebrow mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--geo-healthy)]">
          — Geo-distributed infrastructure
        </p>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
          Route globally.
          <br />
          <span className="text-accent">Operate locally.</span>
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Live geo routing, multi-region replication, and a zero-config console. Browse as a guest,
          sign in when you need to write.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/app" className="auth-hero-btn">
            Open console
          </Link>
          <Link to="/signup" className="auth-hero-btn">
            Create account
          </Link>
        </div>

        <dl className="mt-14 grid grid-cols-3 gap-6 border-t border-border/40 pt-8">
          <div>
            <dt className="text-xs text-muted-foreground">active regions</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--geo-healthy)]">
              {healthyCount || regionTotal || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">live documents</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--geo-healthy)]">
              {docs || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">uptime</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--geo-healthy)]">
              {uptime}
            </dd>
          </div>
        </dl>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 lg:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background/40 text-muted-foreground">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    </section>
  );
}

function IconRail() {
  return (
    <aside className="auth-rail hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border/40 py-6 sm:flex">
      {RAIL_LINKS.map(({ to, icon: Icon, label, ...rest }) => {
        const external = "external" in rest && rest.external;
        const cls =
          "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground";
        return external ? (
          <a key={to} href={to} target="_blank" rel="noopener noreferrer" className={cls} title={label}>
            <Icon className="h-[18px] w-[18px]" />
          </a>
        ) : (
          <Link key={to} to={to} className={cls} title={label}>
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
    </aside>
  );
}

export function AuthLayout({
  children,
  title,
  subtitle,
  mode = "plain",
  footer,
  showOAuth = false,
  inviteToken,
}: Props) {
  const isSplit = mode === "login" || mode === "signup";

  if (!isSplit) {
    return (
      <CinematicShell showPingRail={false}>
        <div className="flex min-h-screen">
          <IconRail />
          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <div className="auth-card w-full max-w-md p-8">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
              <div className="mt-8">{children}</div>
              {footer}
            </div>
          </div>
        </div>
      </CinematicShell>
    );
  }

  return (
    <CinematicShell showPingRail={false} className="min-h-screen">
      <div className="flex min-h-screen flex-col">
        <div className="flex min-h-0 flex-1">
          <IconRail />
          <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
            <AuthHero />

            <section className="flex shrink-0 items-center justify-center border-t border-border/40 px-6 py-10 lg:w-[min(100%,28rem)] lg:border-l lg:border-t-0 xl:w-[32rem]">
              <div className="auth-card w-full max-w-md p-8">
                <AuthTabs mode={mode} />
                <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
                {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
                <div className="mt-8">{children}</div>
                {showOAuth && <AuthOAuth inviteToken={inviteToken} />}
                {footer}
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-border/40 px-6 py-2">
          <LivePingRail />
        </div>
      </div>
    </CinematicShell>
  );
}
