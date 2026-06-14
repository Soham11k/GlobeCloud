import { useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Sidebar, MobileNav, useConsoleNav } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { OverviewPanel, markChecklist } from "@/components/console/Overview";
import { RoutingPanel } from "@/components/console/Routing";
import { InventoryPanel } from "@/components/console/Inventory";
import { ReplicationPanel } from "@/components/console/Replication";
import { CopilotPanel } from "@/components/console/Copilot";
import { FleetPanel } from "@/components/console/Fleet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProduct, useHealth, useSyncMutation, useRouteMutation, useOrderMutation, useAgentMutation } from "@/lib/hooks";
import { api, setApiKey, getApiKey } from "@/lib/api";
import { CHECKLIST_KEY } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const TITLES: Record<string, string> = {
  "/app": "Overview",
  "/app/fleet": "Global Fleet",
  "/app/routing": "Routing",
  "/app/inventory": "Inventory",
  "/app/replication": "Replication",
  "/app/copilot": "Copilot",
};

export function ConsolePage() {
  const location = useLocation();
  const nav = useConsoleNav();
  const queryClient = useQueryClient();
  const { data: product } = useProduct();
  const { data: health } = useHealth();
  const syncMut = useSyncMutation();
  const routeMut = useRouteMutation();
  const orderMut = useOrderMutation();
  const agentMut = useAgentMutation();

  const [region, setRegion] = useState("us-east-1");
  const [client, setClient] = useState({ lat: 40.71, lon: -74.01 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());

  const isGateway = product?.deployment_mode === "gateway";
  const title = TITLES[location.pathname] || "Console";

  const runDemo = useCallback(async () => {
    try {
      toast.info("Running demo flow…");
      nav.goRouting();
      const route = await routeMut.mutateAsync({ lat: 40, lon: -74 });
      setClient({ lat: 40, lon: -74 });
      setRegion(route.selected_region);
      markChecklist("routed");

      nav.goInventory();
      const inv = await api<{ products: { id: string }[] }>(
        `/regions/${route.selected_region}/products`
      );
      if (inv.products[0]) {
        await orderMut.mutateAsync({ region: route.selected_region, productId: inv.products[0].id });
        markChecklist("ordered");
      }

      if (!isGateway) {
        nav.goReplication();
        await syncMut.mutateAsync();
      }

      nav.goCopilot();
      await agentMut.mutateAsync({
        question: "How does cross-region replication work?",
        client_lat: 40,
        client_lon: -74,
      });
      markChecklist("asked");
      toast.success("Demo complete!");
      nav.goOverview();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [nav, routeMut, orderMut, syncMut, agentMut, isGateway]);

  return (
    <div className="flex min-h-screen gradient-mesh">
      <Sidebar
        isGateway={!!isGateway}
        onSettings={() => setSettingsOpen(true)}
        onCommand={() => setCmdOpen(true)}
      />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="flex items-center justify-between gap-4 px-4 md:px-6 py-4 border-b border-border/50 backdrop-blur-xl sticky top-0 z-30 bg-background/80">
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={health?.status === "ok" ? "success" : "danger"}>
              {health?.status === "ok" ? "online" : "offline"}
            </Badge>
            <Badge>{product?.llm_mode ?? "—"} LLM</Badge>
            {isGateway && <Badge variant="accent">gateway</Badge>}
            <Button variant="secondary" size="sm" className="md:hidden" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Routes>
                <Route
                  path="/"
                  element={
                    <OverviewPanel
                      onDemo={runDemo}
                      onSync={() =>
                        syncMut.mutate(undefined, {
                          onSuccess: () => toast.success("Sync complete"),
                          onError: (e) => toast.error(e.message),
                        })
                      }
                    />
                  }
                />
                <Route
                  path="/routing"
                  element={
                    <RoutingPanel
                      onRouted={(r) => {
                        setRegion(r);
                        setClient({ lat: 40.71, lon: -74.01 });
                      }}
                    />
                  }
                />
                <Route
                  path="/inventory"
                  element={<InventoryPanel region={region} onRegionChange={setRegion} />}
                />
                <Route path="/replication" element={<ReplicationPanel />} />
                <Route
                  path="/copilot"
                  element={<CopilotPanel clientLat={client.lat} clientLon={client.lon} />}
                />
                <Route path="/fleet" element={isGateway ? <FleetPanel /> : <Navigate to="/app" replace />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileNav isGateway={!!isGateway} />

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onDemo={runDemo}
        onSync={() => syncMut.mutate()}
      />

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs text-muted-foreground">
                GlobeCloud API key {product?.auth_required ? "(required)" : "(leave blank for local dev)"}
              </label>
              <p className="text-xs text-muted-foreground/80 mt-1">
                Not your OpenAI key — only needed when the host set <code className="text-xs">API_KEY</code> on the server.
              </p>
              <Input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste host-provided key"
                className="mt-1"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => {
                    setApiKey(apiKeyInput.trim());
                    queryClient.invalidateQueries();
                    toast.success("API key saved — refreshing data");
                    setSettingsOpen(false);
                  }}
                >
                  Save key
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setApiKeyInput("");
                    setApiKey("");
                    queryClient.invalidateQueries();
                    toast.success("API key cleared");
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                localStorage.removeItem(CHECKLIST_KEY);
                toast.success("Tutorial reset");
              }}
            >
              Reset tutorial
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
