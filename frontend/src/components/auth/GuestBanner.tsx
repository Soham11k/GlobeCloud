import { Link } from "react-router-dom";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

export function GuestBanner() {
  const { isAuthenticated, loading } = useAuth();

  if (loading || isAuthenticated) return null;

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 md:px-6">
      <p className="text-sm text-muted-foreground">
        You&apos;re browsing as a guest. Sign in to place orders, edit catalog, and use the agent.
      </p>
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <Link to="/signup">Create free account</Link>
      </Button>
    </div>
  );
}
