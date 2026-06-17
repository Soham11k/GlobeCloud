import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { getSession, hydrateAuthFromStorage } from "@/lib/auth";

type Props = {
  children: ReactNode;
};

/** Redirect authenticated users away from login/signup */
export function AuthRedirect({ children }: Props) {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "guest" | "authed">("loading");

  useEffect(() => {
    hydrateAuthFromStorage();
    let active = true;
    getSession().then((user) => {
      if (!active) return;
      setStatus(user ? "authed" : "guest");
    });
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--surface-0,#03030a)]">
        <Logo className="h-8 opacity-90" />
        <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent,#5b52ff)] shadow-[0_0_12px_var(--accent-glow)]" />
      </div>
    );
  }

  if (status === "authed") {
    const next = new URLSearchParams(location.search).get("next") || "/app";
    return <Navigate to={next} replace />;
  }

  return <>{children}</>;
}
