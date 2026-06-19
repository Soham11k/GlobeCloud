import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthStatusCard } from "@/components/auth/AuthStatusCard";
import { CinematicShell } from "@/components/layout/CinematicShell";
import { setAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    fetch("/auth/oauth/complete", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("OAuth failed");
        const data = await res.json();
        setAccessToken(data.access_token);
        navigate("/app", { replace: true });
      })
      .catch(() => setStatus("error"));
  }, [navigate]);

  if (status === "error") {
    return (
      <CinematicShell className="flex min-h-screen items-center justify-center pb-16">
        <AuthStatusCard
          status="error"
          title="Sign-in failed"
          description="We couldn't complete your session. Try again or use email sign-in."
        >
          <Button className="w-full" asChild>
            <Link to="/login">Try again</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/login">Use email instead</Link>
          </Button>
        </AuthStatusCard>
      </CinematicShell>
    );
  }

  return (
    <CinematicShell className="flex min-h-screen items-center justify-center pb-16">
      <AuthStatusCard
        status="loading"
        title="Completing sign-in"
        description="Setting up your session…"
      />
    </CinematicShell>
  );
}
