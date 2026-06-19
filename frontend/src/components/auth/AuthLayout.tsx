import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteIconRail } from "@/components/layout/SiteIconRail";
import { StatusDot } from "@/components/layout/StatusBadge";
import { AuthOAuth } from "@/components/auth/AuthOAuth";
import { useLiveMetrics, useProduct } from "@/lib/hooks";
import { cn } from "@/lib/utils";

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

function AuthSidePanel() {
  const { data: metrics } = useLiveMetrics();
  const { data: product } = useProduct();
  const router = metrics?.router ?? [];

  return (
    <section className="hidden flex-1 flex-col justify-between border-r border-border/40 px-8 py-10 lg:flex xl:px-12">
      <div>
        <p className="font-mono text-xs text-muted-foreground">
          {product?.deployment_mode ?? "regional"}
          {router.length ? ` · ${router.length} regions` : ""}
        </p>
        <h1 className="mt-4 max-w-md text-2xl font-semibold tracking-tight">
          Multi-region Postgres routing on Fly.io
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Transactional outbox replication, geo routing via{" "}
          <code className="font-mono text-xs">POST /api/v1/route</code>, and pgvector RAG agent.
          Guest read access works without signing in.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Live probes</p>
        {router.length ? (
          <ul className="space-y-1.5">
            {router.map((r) => (
              <li
                key={r.region_id}
                className="flex items-center justify-between font-mono text-xs"
              >
                <span className="flex items-center gap-2">
                  <StatusDot status={r.healthy ? "ok" : "err"} />
                  {r.region_id}
                </span>
                <span className={r.healthy ? "text-[var(--geo-healthy)]" : "text-[var(--geo-error)]"}>
                  {r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Waiting for probe data…</p>
        )}
        <div className="mt-6 flex gap-4 text-sm">
          <Link to="/status" className="text-accent hover:underline">
            Status page
          </Link>
          <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            API reference
          </a>
        </div>
      </div>
    </section>
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
  const location = useLocation();
  const isSplit = mode === "login" || mode === "signup";

  if (!isSplit) {
    return (
      <CinematicShell showPingRail={false}>
        <div className="flex min-h-screen">
          <SiteIconRail activePath={location.pathname} />
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
      <div className="flex min-h-screen">
        <SiteIconRail activePath={location.pathname} className="hidden sm:flex" />
        <AuthSidePanel />
        <section className="flex flex-1 items-center justify-center px-6 py-10">
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
    </CinematicShell>
  );
}
