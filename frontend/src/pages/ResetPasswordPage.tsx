import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthStatusCard } from "@/components/auth/AuthStatusCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/layout/FormField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { resetPassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setConfirmError("");
    if (password !== confirm) {
      setConfirmError("Passwords do not match");
      return;
    }
    if (!token) {
      setFormError("Missing reset token");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast.success("Password updated");
      navigate("/login", { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Reset password" subtitle="Invalid or missing reset link.">
        <AuthStatusCard
          status="error"
          title="Link expired"
          description="Request a new reset link from the forgot password page."
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <Button className="w-full" asChild>
            <Link to="/forgot-password">Request new link</Link>
          </Button>
        </AuthStatusCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose new password" subtitle="Enter a strong password for your account.">
      <form onSubmit={submit} className="space-y-5" aria-busy={loading}>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <FormField id="reset-password" label="New password">
          <PasswordInput
            id="reset-password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <FormField id="reset-confirm" label="Confirm password" error={confirmError}>
          <PasswordInput
            id="reset-confirm"
            required
            minLength={8}
            autoComplete="new-password"
            hasError={!!confirmError}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </FormField>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
