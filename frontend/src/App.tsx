import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LandingGate } from "@/pages/LandingGate";
import { WelcomePage } from "@/pages/WelcomePage";
import { ConsolePage } from "@/pages/ConsolePage";
import { StatusPage } from "@/pages/StatusPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { AuthRedirect } from "@/components/auth/AuthRedirect";
import { hydrateAuthFromStorage } from "@/lib/auth";

hydrateAuthFromStorage();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000, retry: 1 },
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
              <Route path="/signup" element={<AuthRedirect><SignupPage /></AuthRedirect>} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/" element={<LandingGate />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/app/*" element={<ConsolePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
