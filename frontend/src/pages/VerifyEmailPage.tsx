import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { verifyEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus("ok");
        toast.success("Email verified");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <AuthLayout title="Verify email" subtitle="Confirming your email address.">
      {status === "loading" && <p className="text-sm text-muted-foreground">Verifying…</p>}
      {status === "ok" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Your email is verified. You&apos;re all set.</p>
          <Button variant="outline" className="auth-submit-btn w-full" onClick={() => navigate("/app")}>
            Open console
          </Button>
        </div>
      )}
      {status === "error" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This link is invalid or expired. Request a new verification email from your account settings.
          </p>
          <Button variant="outline" className="auth-submit-btn w-full" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
