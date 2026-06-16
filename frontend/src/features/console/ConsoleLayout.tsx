import { Link, useLocation, Outlet } from "react-router-dom";
import { useState } from "react";
import {
  LayoutGrid,
  Route,
  Package,
  RefreshCw,
  MessageSquare,
  Globe,
  BookOpen,
  ScrollText,
  Settings,
  ExternalLink,
} from "lucide-react";
import { useProduct, useHealth, useMetrics } from "@/lib/hooks";
import { setApiKey, getApiKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConsoleProvider } from "./ConsoleContext";
import { StatusLED, Chip } from "./components/ui";
import "./console.css";

const NAV = [
  { to: "/app", icon: LayoutGrid, label: "Ops", end: true },
  { to: "/app/route", icon: Route, label: "Route" },
  { to: "/app/catalog", icon: Package, label: "Catalog" },
  { to: "/app/sync", icon: RefreshCw, label: "Sync" },
  { to: "/app/agent", icon: MessageSquare, label: "Agent" },
  { to: "/app/docs", icon: BookOpen, label: "Docs" },
  { to: "/app/audit", icon: ScrollText, label: "Audit" },
  { to: "/app/fleet", icon: Globe, label: "Fleet", gateway: true },
] as const;

function ConsoleShell() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: product } = useProduct();
  const { data: health } = useHealth();
  const { data: metrics } = useMetrics();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());

  const isGateway = product?.deployment_mode === "gateway";
  const healthyCount = metrics?.router.filter((r) => r.healthy).length ?? 0;
  const regionCount = metrics?.router.length ?? product?.regions ?? 0;
  const provider =
    product?.llm_mode === "openai" ? "OpenAI" : product?.llm_mode === "mock" ? "Local heuristic" : product?.llm_mode;

  const navItems = NAV.filter((n) => !("gateway" in n && n.gateway) || isGateway);

  return (
    <div className="console-root flex min-h-screen">
      <aside className="console-rail hidden md:flex flex-col items-center py-3 gap-1 shrink-0">
        <Link to="/" className="mb-4 flex h-8 w-8 items-center justify-center" title="GlobeCloud">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gc-accent)] shadow-[0_0_10px_rgba(91,82,255,0.6)]" />
        </Link>
        {navItems.map((item) => {
          const { to, icon: Icon, label } = item;
          const end = "end" in item && item.end;
          const active = end
            ? location.pathname === "/app" || location.pathname === "/app/"
            : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              title={label}
              data-active={active}
              className="console-nav-item flex h-10 w-10 items-center justify-center rounded-sm"
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col gap-1">
          <button
            type="button"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
            className="console-nav-item flex h-10 w-10 items-center justify-center rounded-sm"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <div className="console-main flex min-w-0 flex-1 flex-col">
        <header className="console-topbar flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex items-center gap-3">
            <StatusLED status={health?.status === "ok" ? "ok" : "err"} />
            <span className="text-sm font-medium tracking-tight">GlobeCloud</span>
            <Chip>{product?.deployment_mode ?? "—"}</Chip>
            {product?.is_simulated && <Chip variant="warn">single-host</Chip>}
          </div>
          <div className="flex flex-wrap items-center gap-2 console-mono text-[10px] text-[var(--gc-muted)]">
            <span>{healthyCount}/{regionCount} regions</span>
            <span className="text-[var(--gc-dim)]">·</span>
            <span>provider: {provider}</span>
            <span className="text-[var(--gc-dim)]">·</span>
            <span>{product?.catalog_products ?? 0} SKUs</span>
            <span className="text-[var(--gc-dim)]">·</span>
            <span>{product?.knowledge_docs ?? 0} docs</span>
            <a href="/api/docs" target="_blank" rel="noopener" className="console-mono text-[var(--gc-accent)] hover:underline flex items-center gap-1 ml-1">
              API <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>

        {product?.simulation_note && (
          <p className="border-b border-[var(--gc-border)] bg-[var(--gc-surface)] px-4 py-2 console-mono text-[10px] text-[var(--gc-warn)] md:px-6">
            {product.simulation_note}
          </p>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>

        <nav className="console-topbar flex md:hidden justify-around py-2">
          {navItems.slice(0, 5).map((item) => {
            const { to, icon: Icon } = item;
            const end = "end" in item && item.end;
            const active = end
              ? location.pathname === "/app" || location.pathname === "/app/"
              : location.pathname.startsWith(to);
            return (
              <Link key={to} to={to} className={active ? "text-[var(--gc-accent)]" : "text-[var(--gc-dim)]"}>
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setSettingsOpen(false)}>
          <div
            className="console-panel h-full w-full max-w-sm border-l border-[var(--gc-border)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold mb-4">Connection</h2>
            <label className="block space-y-2 mb-4">
              <span className="console-mono text-[10px] text-[var(--gc-dim)]">X-API-Key (GlobeCloud host)</span>
              <input
                type="password"
                className="console-input"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Leave blank for open local dev"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="console-btn console-btn-primary flex-1"
                onClick={() => {
                  setApiKey(apiKeyInput.trim());
                  queryClient.invalidateQueries();
                  toast.success("API key saved");
                  setSettingsOpen(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="console-btn"
                onClick={() => {
                  setApiKeyInput("");
                  setApiKey("");
                  queryClient.invalidateQueries();
                  toast.success("API key cleared");
                }}
              >
                Clear
              </button>
            </div>
            <p className="console-mono mt-4 text-[10px] text-[var(--gc-dim)] leading-relaxed">
              OpenAI runs on the server via OPENAI_API_KEY — not entered here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConsoleLayout() {
  return (
    <ConsoleProvider>
      <ConsoleShell />
    </ConsoleProvider>
  );
}
