import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Route,
  Package,
  RefreshCw,
  Bot,
  Globe2,
  Settings,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { to: "/app", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/app/fleet", icon: Globe2, label: "Fleet", gateway: true },
  { to: "/app/routing", icon: Route, label: "Routing" },
  { to: "/app/inventory", icon: Package, label: "Inventory" },
  { to: "/app/replication", icon: RefreshCw, label: "Replication" },
  { to: "/app/copilot", icon: Bot, label: "Copilot" },
];

export function Sidebar({
  isGateway,
  onSettings,
  onCommand,
}: {
  isGateway: boolean;
  onSettings: () => void;
  onCommand: () => void;
}) {
  const location = useLocation();

  return (
    <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card p-4 gap-1 shrink-0">
      <Logo to="/app" className="px-2 py-3 mb-2" />
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.filter((n) => !n.gateway || isGateway).map(({ to, icon: Icon, label, end }) => {
          const active = end
            ? location.pathname === "/app" || location.pathname === "/app/"
            : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border-l-2 border-transparent",
                active
                  ? "bg-muted text-foreground border-accent"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-2 pt-4 border-t border-border">
        <Button variant="ghost" size="sm" className="justify-start" onClick={onCommand}>
          <Command className="h-4 w-4 mr-2" />
          Command
          <kbd className="ml-auto text-xs text-muted-foreground">⌘K</kbd>
        </Button>
        <Button variant="ghost" size="sm" className="justify-start" onClick={onSettings}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav({ isGateway }: { isGateway: boolean }) {
  const location = useLocation();
  const items = NAV.filter((n) => !n.gateway || isGateway);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-border bg-card/95 backdrop-blur-xl pb-safe">
      {items.map(({ to, icon: Icon, label, end }) => {
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
            {label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}

export function useConsoleNav() {
  const navigate = useNavigate();
  return {
    goOverview: () => navigate("/app"),
    goRouting: () => navigate("/app/routing"),
    goInventory: () => navigate("/app/inventory"),
    goReplication: () => navigate("/app/replication"),
    goCopilot: () => navigate("/app/copilot"),
    goFleet: () => navigate("/app/fleet"),
  };
}
