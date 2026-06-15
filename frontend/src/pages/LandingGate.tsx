import { Navigate } from "react-router-dom";
import { hasWelcomed } from "@/lib/welcome";
import { LandingPage } from "@/pages/LandingPage";

export function LandingGate() {
  if (!hasWelcomed()) {
    return <Navigate to="/welcome" replace />;
  }
  return <LandingPage />;
}
