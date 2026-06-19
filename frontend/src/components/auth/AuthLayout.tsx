import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { SiteIconRail } from "@/components/layout/SiteIconRail";
import { StatusDot } from "@/components/layout/StatusBadge";
import { AuthOAuth } from "@/components/auth/AuthOAuth";
import { useLiveMetrics, useProduct } from "@/lib/hooks";
import { fadeUp, pageVariants } from "@/lib/motion";
import { useMotionPrefs } from "@/lib/useMotionPrefs";
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
    <div className="auth-tabs mb-8 grid grid-cols-2 gap-2" role="tablist" aria-label="Authentication">
      <Link
        to={`/login${qs}`}
        role="tab"
        aria-selected={mode === "login"}
        aria-current={mode === "login" ? "page" : undefined}
        className={cn("auth-tab", mode === "login" && "auth-tab-active")}
      >
        Sign in
      </Link>
      <Link
        to={`/signup${qs}`}
        role="tab"
        aria-selected={mode === "signup"}
        aria-current={mode === "signup" ? "page" : undefined}
        className={cn("auth-tab", mode === "signup" && "auth-tab-active")}
      >
        Register
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
      <div className="mb-6 rounded-lg border border-border/40 bg-muted/10 px-4 py-3 lg:hidden">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Live probes</p>
        <ul className="flex flex-wrap gap-3">
          {router.slice(0, 3).map((r) => (
            <li key={r.region_id} className="flex items-center gap-1.5 font-mono text-[10px]">
              <StatusDot status={r.healthy ? "ok" : "err"} />
              {r.region_id}
            </li>
          ))}
        </ul>
      </div>
    );
  }

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
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Live probes</p>
        {router.length ? (
          <ul className="space-y-1.5">
            {router.map((r) => (
              <li key={r.region_id} className="flex items-center justify-between font-mono text-xs">
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

function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  const { reducedMotion } = useMotionPrefs();
  if (reducedMotion) {
    return <div className={cn("auth-card w-full max-w-md p-8", className)}>{children}</div>;
  }
  return (
    <motion.div
      className={cn("auth-card w-full max-w-md p-8", className)}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
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
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
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
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
              {title}
            </h2>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            {showOAuth && (
              <div className="mt-8">
                <AuthOAuth inviteToken={inviteToken} />
              </div>
            )}
            {showOAuth && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[var(--auth-card-bg)] px-3 text-muted-foreground">or use email</span>
                </div>
              </div>
            )}
            <motion.div variants={fadeUp} initial="initial" animate="animate">
              {children}
            </motion.div>
            {footer}
          </AuthCard>
        </section>
      </div>
    </CinematicShell>
  );
}
