import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/layout/FormField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { login } from "@/lib/auth";
import { oauthErrorMessage } from "@/lib/oauthErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const oauthError = params.get("oauth_error");
  const oauthProvider = params.get("provider");
  const oauthRedirectUri = params.get("redirect_uri");
  const signupQs = new URLSearchParams();
  if (next !== "/app") signupQs.set("next", next);
  const signupLink = signupQs.toString() ? `/signup?${signupQs}` : "/signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      navigate(next, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      mode="login"
      title="Welcome back"
      subtitle="Sign in to access write controls."
      showOAuth
      header={
        oauthError ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {oauthErrorMessage(oauthError, oauthProvider, oauthRedirectUri)}
            </AlertDescription>
          </Alert>
        ) : null
      }
      footer={
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to={signupLink} className="text-accent hover:underline">
            Create one
          </Link>
          {" · "}
          <Link to="/app" className="text-accent hover:underline">
            Browse as guest
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-5" aria-busy={loading}>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <FormField id="login-email" label="Email">
          <Input
            id="login-email"
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
        <FormField
          id="login-password"
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link to="/forgot-password" className="text-xs text-accent hover:underline">
                Forgot?
              </Link>
            </span>
          }
        >
          <PasswordInput
            id="login-password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
