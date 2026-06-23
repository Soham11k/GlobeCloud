import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteIconRail } from "@/components/layout/SiteIconRail";
import { DotLabel } from "@/components/brand/DotLabel";
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
  header?: ReactNode;
};

function AuthTabs({ mode }: { mode: "login" | "signup" }) {
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next");
  const oauthError = new URLSearchParams(location.search).get("oauth_error");
  const nextQ = new URLSearchParams();
  if (next) nextQ.set("next", next);
  if (oauthError) nextQ.set("oauth_error", oauthError);
  const provider = new URLSearchParams(location.search).get("provider");
  if (provider) nextQ.set("provider", provider);
  const qs = nextQ.toString() ? `?${nextQ.toString()}` : "";

  return (
    <div className="auth-tabs mb-8 flex" role="tablist" aria-label="Authentication">
      <Link
        to={`/login${qs}`}
        role="tab"
        aria-selected={mode === "login"}
        aria-current={mode === "login" ? "page" : undefined}
        className={cn("auth-tab flex-1", mode === "login" && "auth-tab-active")}
      >
        Sign in
      </Link>
      <Link
        to={`/signup${qs}`}
        role="tab"
        aria-selected={mode === "signup"}
        aria-current={mode === "signup" ? "page" : undefined}
        className={cn("auth-tab flex-1", mode === "signup" && "auth-tab-active")}
      >
        Create account
      </Link>
    </div>
  );
}

function AuthSidePanel({ compact }: { compact?: boolean }) {
  const { data: metrics } = useLiveMetrics();
  const { data: product } = useProduct();
  const router = metrics?.router ?? [];

  if (compact) {
    if (!router.length) return null;
    return (
      <div className="mb-6 border border-border px-4 py-3 lg:hidden">
        <DotLabel className="mb-2">Live probes</DotLabel>
        <p className="data-mono">
          {router.slice(0, 3).map((r) => `${r.region_id} ${r.healthy ? "ok" : "down"}`).join(" · ")}
        </p>
      </div>
    );
  }

  return (
    <section className="hidden flex-1 flex-col justify-between border-r border-border px-8 py-10 lg:flex xl:px-12">
      <div>
        <DotLabel>
          {product?.deployment_mode ?? "regional"}
          {router.length ? ` · ${router.length} regions` : ""}
        </DotLabel>
        <h1 className="mt-4 max-w-md text-2xl font-medium tracking-[-0.03em]">
          Multi-region Postgres routing on Fly.io
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Transactional outbox replication, geo routing via{" "}
          <code className="font-mono text-xs">POST /api/v1/route</code>, and pgvector RAG agent.
        </p>
      </div>
      <div>
        <DotLabel className="mb-3">Live probes</DotLabel>
        {router.length ? (
          <ul className="divide-y divide-border border border-border">
            {router.map((r) => (
              <li key={r.region_id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="data-mono">{r.region_id}</span>
                <span className={r.healthy ? "text-muted-foreground" : "text-[var(--color-danger)]"}>
                  {r.healthy ? "ok" : "down"}
                  {r.latency_ms != null ? ` · ${Math.round(r.latency_ms)} ms` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for probe data…</p>
        )}
        <div className="mt-6 flex gap-4 text-sm">
          <Link to="/status" className="underline">Status</Link>
          <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="underline">
            API docs
          </a>
        </div>
      </div>
    </section>
  );
}

function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("auth-card w-full max-w-md p-8", className)}>{children}</div>;
}

export function AuthLayout({
  children,
  title,
  subtitle,
  mode = "plain",
  footer,
  showOAuth = false,
  inviteToken,
  header,
}: Props) {
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isSplit = mode === "login" || mode === "signup";

  useEffect(() => {
    headingRef.current?.focus();
  }, [location.pathname]);

  if (!isSplit) {
    return (
      <CinematicShell showPingRail={false}>
        <div className="flex min-h-screen pb-16">
          <SiteIconRail activePath={location.pathname} />
          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <AuthCard>
              {header}
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
                {title}
              </h1>
              {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
              <div className="mt-8">{children}</div>
              {footer}
            </AuthCard>
          </div>
        </div>
      </CinematicShell>
    );
  }

  return (
    <CinematicShell showPingRail={false} className="min-h-screen">
      <div className="flex min-h-screen pb-16">
        <SiteIconRail activePath={location.pathname} className="hidden sm:flex" />
        <AuthSidePanel />
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <AuthCard>
            <AuthTabs mode={mode} />
            <AuthSidePanel compact />
            {header}
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
              {title}
            </h2>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            {showOAuth && (
              <div className="mt-8">
                <AuthOAuth inviteToken={inviteToken} />
              </div>
            )}
            {showOAuth && (
              <div className="my-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
                or use email
              </div>
            )}
            <div>{children}</div>
            {footer}
          </AuthCard>
        </section>
      </div>
    </CinematicShell>
  );
}
