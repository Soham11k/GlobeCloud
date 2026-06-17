import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken } from "@/lib/auth";

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-0,#03030a)] text-sm text-muted-foreground">
      Completing sign-in…
    </div>
  );
}
