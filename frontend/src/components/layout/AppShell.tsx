import { useEffect, useState, type ComponentType } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { Menu, ExternalLink, LogOut, User, Search } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusDot } from "@/components/layout/StatusBadge";
import { SiteIconRail } from "@/components/layout/SiteIconRail";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { GuestBanner } from "@/components/auth/GuestBanner";
import { LivePingRail } from "@/components/layout/LivePingRail";
import { useProduct, useHealth, useLiveMetrics } from "@/lib/hooks";
import { getCachedUser, getSession, logout, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, MOBILE_SHORTCUTS, flattenNav } from "@/features/console/nav";
import { useSyncMutation } from "@/lib/hooks";
import { toast } from "sonner";

function NavLink({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const active = end
    ? location.pathname === "/app" || location.pathname === "/app/"
    : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "bg-accent/12 text-accent"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function ConsoleNav({ isGateway, onNavigate }: { isGateway: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.gateway || isGateway);
        if (!items.length) return null;
        return (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavLink key={item.to} {...item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: product } = useProduct();
  const { data: health } = useHealth();
  const { data: metrics } = useLiveMetrics();
  const syncRun = useSyncMutation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());

  useEffect(() => {
    getSession().then(setUser);
  }, []);

  const isGateway = product?.deployment_mode === "gateway";
  const healthyCount = metrics?.router.filter((r) => r.healthy).length ?? 0;
  const regionCount = metrics?.router.length ?? product?.regions ?? 0;
  const navItems = flattenNav(isGateway);

  const settingsCrumb = location.pathname.startsWith("/app/settings/")
    ? location.pathname.split("/").pop()?.replace("-", " ")
    : null;

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  const runSync = () => {
    syncRun.mutate(undefined, {
      onSuccess: (d) => toast.success(`Applied ${d.entries_applied ?? 0} entries`),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="cinematic-shell flex min-h-screen text-foreground">
      <SiteIconRail activePath={location.pathname} className="hidden sm:flex" />

      {/* Desktop nav column */}
      <aside
        className="console-chrome hidden w-[var(--console-nav-width)] shrink-0 flex-col border-r sm:flex"
      >
        <div className="flex h-[var(--header-height)] items-center border-b border-border/40 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <Logo className="h-6" />
          </Link>
        </div>
        <ConsoleNav isGateway={isGateway} />
        <div className="mt-auto space-y-2 border-t border-border/40 p-3">
          {user && (
            <div className="console-panel px-3 py-2">
              <p className="truncate text-sm font-medium">{user.name || user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setCmdOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="ml-2">Search</span>
            <kbd className="ml-auto text-[10px] text-muted-foreground">⌘K</kbd>
          </Button>
          {user && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="console-chrome sticky top-0 z-40 border-b">
          <div className="flex h-[var(--header-height)] items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 sm:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <StatusDot status={health?.status === "ok" ? "ok" : "err"} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">GlobeCloud Console</p>
                {settingsCrumb && (
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    Settings · {settingsCrumb}
                  </p>
                )}
              </div>
              <Badge variant="accent" className="hidden capitalize sm:inline-flex">
                {product?.deployment_mode ?? "—"}
              </Badge>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              <span className="hidden font-mono tabular-nums md:inline">
                {healthyCount}/{regionCount} healthy
              </span>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                API <ExternalLink className="h-3 w-3" />
              </a>
              {!user && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
          <div className="border-t border-border/40 bg-[var(--surface-0)] px-4 py-1.5 md:px-6">
            <LivePingRail />
          </div>
        </header>

        <GuestBanner />

        <main className="relative z-10 flex-1 overflow-auto p-4 md:p-6">
          <div className="content-wrap space-y-6">
            <Outlet />
          </div>
        </main>

        <div className="sm:hidden">
          <div className="console-chrome border-t px-3 py-1.5">
            <LivePingRail compact />
          </div>
          <nav className="console-chrome flex border-t">
            {MOBILE_SHORTCUTS.map((item) => {
              const { to, icon: Icon, label } = item;
              const end = "end" in item && item.end;
              const active = end
                ? location.pathname === "/app" || location.pathname === "/app/"
                : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                    active ? "text-accent" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </nav>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100%,18rem)] p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle>
              <Logo className="h-6" />
            </SheetTitle>
          </SheetHeader>
          <ConsoleNav isGateway={isGateway} onNavigate={() => setMobileOpen(false)} />
          {user && (
            <div className="mt-auto space-y-2 border-t border-border p-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{user.email}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        navItems={navItems}
        onSync={runSync}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
