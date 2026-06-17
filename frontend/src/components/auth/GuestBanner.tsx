import { Link } from "react-router-dom";
import { useAuth } from "@/lib/useAuth";

export function GuestBanner() {
  const { isAuthenticated, loading } = useAuth();

  if (loading || isAuthenticated) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--gc-border)] bg-[var(--gc-accent-dim)] px-4 py-2 md:px-6">
      <p className="console-mono text-[10px] text-[var(--gc-muted)]">
        Browsing as guest — sign in to create orders, edit catalog, or run the agent
      </p>
      <Link
        to="/login"
        className="console-mono text-[10px] font-medium text-[var(--gc-accent)] hover:underline shrink-0"
      >
        Sign in →
      </Link>
    </div>
  );
}
