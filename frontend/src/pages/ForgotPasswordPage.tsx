import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthStatusCard } from "@/components/auth/AuthStatusCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/layout/FormField";
import { forgotPassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success("If an account exists, we sent a reset link");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="We'll email you a link to choose a new password."
      footer={
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="underline">
            ← Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <AuthStatusCard
          status="success"
          title="Check your inbox"
          description="If an account exists for that email, we sent a reset link. It expires in 2 hours."
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <Button variant="outline" className="w-full" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
        </AuthStatusCard>
      ) : (
        <form onSubmit={submit} className="space-y-5" aria-busy={loading}>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <FormField id="forgot-email" label="Email">
            <Input
              id="forgot-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@company.com"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
