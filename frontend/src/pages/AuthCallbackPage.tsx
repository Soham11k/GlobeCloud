import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken } from "@/lib/auth";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { LoadingState } from "@/components/layout/LoadingState";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/auth/oauth/complete", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("OAuth failed");
        const data = await res.json();
        setAccessToken(data.access_token);
        navigate("/app", { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return (
    <CinematicShell className="flex min-h-screen items-center justify-center">
      <div className="console-panel px-8 py-6">
        <LoadingState rows={1} />
        <p className="mt-4 text-center text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    </CinematicShell>
  );
}
