import { Routes, Route, Navigate } from "react-router-dom";
import { ConsoleLayout } from "./ConsoleLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { RoutePage } from "./pages/RoutePage";
import { CatalogPage } from "./pages/CatalogPage";
import { SyncPage } from "./pages/SyncPage";
import { AgentPage } from "./pages/AgentPage";
import { DocsPage } from "./pages/DocsPage";
import { AuditPage } from "./pages/AuditPage";
import { FleetPage } from "./pages/FleetPage";
import { BillingPage } from "./pages/BillingPage";
import { TeamPage } from "./pages/TeamPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { useProduct } from "@/lib/hooks";

function FleetGuard() {
  const { data: product } = useProduct();
  if (product?.deployment_mode !== "gateway") {
    return <Navigate to="/app" replace />;
  }
  return <FleetPage />;
}

/** Legacy path redirects */
function LegacyRedirect({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

export function ConsoleApp() {
  return (
    <Routes>
      <Route element={<ConsoleLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="route" element={<RoutePage />} />
        <Route path="routing" element={<LegacyRedirect to="/app/route" />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="inventory" element={<LegacyRedirect to="/app/catalog" />} />
        <Route path="sync" element={<SyncPage />} />
        <Route path="replication" element={<LegacyRedirect to="/app/sync" />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="copilot" element={<LegacyRedirect to="/app/agent" />} />
        <Route path="docs" element={<DocsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings/billing" element={<BillingPage />} />
        <Route path="settings/team" element={<TeamPage />} />
        <Route path="settings/api-keys" element={<ApiKeysPage />} />
        <Route path="fleet" element={<FleetGuard />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  );
}
