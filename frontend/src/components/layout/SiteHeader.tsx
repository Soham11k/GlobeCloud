import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/useAuth";
import { LivePingRail } from "@/components/layout/LivePingRail";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  onNavigate?: () => void;
  showMarketingLinks?: boolean;
  showPingRail?: boolean;
};

const NAV_LINKS = [
  { href: "/#how", label: "How it works", external: false },
  { href: "/#pricing", label: "Pricing", external: false },
  { href: "/status", label: "Status", external: false },
  { href: "/api/docs", label: "Docs", external: true },
];

export function SiteHeader({ className, onNavigate, showMarketingLinks = true, showPingRail = true }: Props) {
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
    onNavigate?.();
  };

  return (
    <header className={cn("sticky top-0 z-40 border-b console-chrome", className)}>
      <div className="section-wrap flex h-14 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {showMarketingLinks && (
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Logo />
        </div>
        {showMarketingLinks && (
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex" aria-label="Main navigation">
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : link.href.startsWith("/#") ? (
                <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className="transition-colors hover:text-foreground"
                  onClick={onNavigate}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        )}
        <div className="flex gap-2">
          {!isAuthenticated && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link to="/login" onClick={onNavigate}>
                Sign in
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link to="/app" onClick={onNavigate}>
              <span className="hidden sm:inline">Open console</span>
              <span className="sm:hidden">Console</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
      {showPingRail && (
        <div className="section-wrap border-t border-border/30 py-1.5">
          <LivePingRail />
        </div>
      )}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[280px]">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                  className="rounded-md px-3 py-2.5 text-sm hover:bg-muted"
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              ) : link.href.startsWith("/#") ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2.5 text-sm hover:bg-muted"
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className="rounded-md px-3 py-2.5 text-sm hover:bg-muted"
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              )
            )}
            {!isAuthenticated && (
              <Link
                to="/login"
                className="mt-4 rounded-md px-3 py-2.5 text-sm font-medium text-accent hover:bg-muted"
                onClick={closeMenu}
              >
                Sign in
              </Link>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
