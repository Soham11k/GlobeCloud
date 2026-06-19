import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/layout/FormField";
import { PasswordInput, PasswordStrength } from "@/components/auth/PasswordInput";
import { register } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") || undefined;
  const next = searchParams.get("next");
  const loginQs = new URLSearchParams();
  if (inviteToken) loginQs.set("invite", inviteToken);
  if (next) loginQs.set("next", next);
  const loginLink = loginQs.toString() ? `/login?${loginQs}` : "/login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    try {
      await register(email, password, name, inviteToken);
      toast.success("Account created");
      navigate(next || "/app", { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      mode="signup"
      title={inviteToken ? "Join the team" : "Create account"}
      subtitle={
        inviteToken
          ? "Set up your account to accept the invite."
          : "Full write access to catalog, orders, and agent."
      }
      showOAuth
      inviteToken={inviteToken}
      footer={
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to={loginLink} className="text-accent hover:underline">
            Sign in
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
        <FormField id="signup-name" label="Name">
          <Input
            id="signup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
            className="auth-input"
          />
        </FormField>
        <FormField id="signup-email" label="Email">
          <Input
            id="signup-email"
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
        <FormField id="signup-password" label="Password" hint="At least 8 characters">
          <PasswordInput
            id="signup-password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </FormField>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
