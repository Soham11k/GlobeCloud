import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { LivePingRail } from "@/components/layout/LivePingRail";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  onNavigate?: () => void;
  showMarketingLinks?: boolean;
  showPingRail?: boolean;
};

export function SiteHeader({ className, onNavigate, showMarketingLinks = true, showPingRail = true }: Props) {
  const { isAuthenticated } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b console-chrome",
        className
      )}
    >
      <div className="section-wrap flex h-14 items-center justify-between">
        <Logo />
        {showMarketingLinks && (
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="/#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="/#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <Link to="/status" className="transition-colors hover:text-foreground" onClick={onNavigate}>
              Status
            </Link>
            <a href="/api/docs" target="_blank" rel="noopener" className="transition-colors hover:text-foreground">
              Docs
            </a>
          </nav>
        )}
        <div className="flex gap-2">
          {!isAuthenticated && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login" onClick={onNavigate}>
                Sign in
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link to="/app" onClick={onNavigate}>
              Open console <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
      {showPingRail && (
        <div className="section-wrap border-t border-border/30 py-1.5">
          <LivePingRail />
        </div>
      )}
    </header>
  );
}
