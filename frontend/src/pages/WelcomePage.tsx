import { Navigate } from "react-router-dom";
import { hasWelcomed } from "@/lib/welcome";
import { CinematicWelcomePage } from "./CinematicWelcomePage";

export function WelcomePage() {
  if (hasWelcomed()) {
    return <Navigate to="/app" replace />;
  }
  return <CinematicWelcomePage />;
}
