import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { resetPassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (!token) {
      toast.error("Missing reset token");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast.success("Password updated");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Reset password" subtitle="Invalid or missing reset link.">
        <p className="text-sm text-muted-foreground">Request a new link from the forgot password page.</p>
        <Button variant="outline" className="auth-submit-btn mt-6 w-full" asChild>
          <Link to="/forgot-password">Forgot password</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose new password" subtitle="Enter a strong password for your account.">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">New password</label>
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Confirm password</label>
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="auth-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">At least 8 characters</p>
        </div>
        <Button type="submit" variant="outline" className="auth-submit-btn w-full" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
