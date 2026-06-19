import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthStatusCard } from "@/components/auth/AuthStatusCard";
import { verifyEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">(() =>
    token ? "loading" : "error",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => {
        setStatus("ok");
        toast.success("Email verified");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  return (
    <AuthLayout title="Verify email" subtitle="Confirming your email address.">
      {status === "loading" && (
        <AuthStatusCard
          status="loading"
          title="Verifying email"
          description="This only takes a moment…"
          className="border-0 bg-transparent p-0 shadow-none"
        />
      )}
      {status === "ok" && (
        <AuthStatusCard
          status="success"
          title="Email verified"
          description="Your email is confirmed. You're all set."
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <Button className="w-full" onClick={() => navigate("/app")}>
            Open console
          </Button>
        </AuthStatusCard>
      )}
      {status === "error" && (
        <AuthStatusCard
          status="error"
          title="Verification failed"
          description={
            errorMessage ||
            "This link is invalid or expired. Sign in and request a new verification email."
          }
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <Button variant="outline" className="w-full" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </AuthStatusCard>
      )}
    </AuthLayout>
  );
}
