import { useEffect, useState, type ComponentType } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  User,
  Search,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusDot } from "@/components/layout/StatusBadge";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { GuestBanner } from "@/components/auth/GuestBanner";
import { LivePingRail } from "@/components/layout/LivePingRail";
import { useProduct, useHealth, useLiveMetrics, useRegions } from "@/lib/hooks";
import { getCachedUser, getSession, logout, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, MOBILE_SHORTCUTS, flattenNav } from "@/features/console/nav";
import { useSyncMutation } from "@/lib/hooks";
import { GlobeScene3DLazy } from "@/components/globe/GlobeScene3DLazy";
import { toast } from "sonner";

function NavLink({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  collapsed?: boolean;
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
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active ? "bg-accent/15 text-accent glow-ring shadow-[0_0_12px_rgba(91,82,255,0.2)]" : "text-muted-foreground hover:text-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function SidebarNav({
  collapsed,
  isGateway,
  onNavigate,
}: {
  collapsed: boolean;
  isGateway: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.gateway || isGateway);
        if (!items.length) return null;
        return (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  {...item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
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
  const { data: regions } = useRegions();
  const syncRun = useSyncMutation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());

  useEffect(() => {
    getSession().then(setUser);
  }, []);

  const isGateway = product?.deployment_mode === "gateway";
  const healthyCount = metrics?.router.filter((r) => r.healthy).length ?? 0;
  const regionCount = metrics?.router.length ?? product?.regions ?? 0;
  const latencies = Object.fromEntries(
    (metrics?.router ?? []).filter((r) => r.latency_ms != null).map((r) => [r.region_id, r.latency_ms as number])
  );
  const healthyMap = Object.fromEntries((metrics?.router ?? []).map((r) => [r.region_id, r.healthy]));
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
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "glass hidden shrink-0 flex-col border-r border-border/60 md:flex transition-[width] duration-200",
          collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]"
        )}
      >
        <div className={cn("flex h-[var(--header-height)] items-center border-b border-border px-4", collapsed && "justify-center px-2")}>
          <Link to="/" className="flex items-center gap-2 min-w-0">
            {!collapsed ? <Logo className="h-6" /> : <span className="h-2 w-2 rounded-full bg-accent" />}
          </Link>
        </div>
        <SidebarNav collapsed={collapsed} isGateway={isGateway} />
        <div className="mt-auto border-t border-border p-3 space-y-2">
          {user && !collapsed && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="truncate text-sm font-medium">{user.name || user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          )}
          <div className={cn("flex gap-1", collapsed ? "flex-col" : "")}>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              className={cn(!collapsed && "flex-1 justify-start")}
              onClick={() => setCmdOpen(true)}
              title="Command palette"
            >
              <Search className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Search</span>}
              {!collapsed && <kbd className="ml-auto text-[10px] text-muted-foreground">⌘K</kbd>}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          {user && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </Button>
          )}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "pointer-events-none fixed inset-y-0 right-0 z-0 opacity-[0.18]",
            collapsed ? "left-[var(--sidebar-width-collapsed)]" : "left-[var(--sidebar-width)]",
            "hidden md:block"
          )}
          aria-hidden
        >
          <GlobeScene3DLazy
            className="h-full w-full"
            variant="ambient"
            regions={regions?.regions}
            latencies={latencies}
            healthy={healthyMap}
          />
        </div>

        <header className="glass sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl">
          <div className="flex h-[var(--header-height)] items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <StatusDot status={health?.status === "ok" ? "ok" : "err"} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">GlobeCloud</p>
              {settingsCrumb && (
                <p className="text-xs text-muted-foreground capitalize truncate">Settings · {settingsCrumb}</p>
              )}
            </div>
            <Badge variant="accent" className="hidden sm:inline-flex capitalize">
              {product?.deployment_mode ?? "—"}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <span className="hidden sm:inline">
              {healthyCount}/{regionCount} regions healthy
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
          <div className="hidden border-t border-border/40 px-4 py-1 md:block md:px-6">
            <LivePingRail />
          </div>
        </header>

        <GuestBanner />

        <main className="relative z-10 flex-1 overflow-auto p-4 md:p-6">
          <div className="content-wrap space-y-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile ping + shortcuts */}
        <div className="md:hidden">
          <div className="glass border-t border-border/40 px-3 py-1 backdrop-blur-xl">
            <LivePingRail compact />
          </div>
          <nav className="glass flex border-t border-border/60 backdrop-blur-xl">
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
                  active ? "text-accent" : "text-muted-foreground"
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
          <SidebarNav
            collapsed={false}
            isGateway={isGateway}
            onNavigate={() => setMobileOpen(false)}
          />
          {user && (
            <div className="mt-auto border-t border-border p-4 space-y-2">
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
