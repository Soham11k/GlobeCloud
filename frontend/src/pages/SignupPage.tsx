import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { register } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") || undefined;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const strength =
    password.length >= 12 ? "strong" : password.length >= 8 ? "good" : password.length > 0 ? "weak" : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name, inviteToken);
      toast.success("Account created");
      navigate("/app", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
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
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="auth-input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <Input
            type="email"
            required
            placeholder="you@company.com"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Password</label>
          <Input
            type="password"
            required
            minLength={8}
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {strength && (
            <p className={`text-xs ${strength === "weak" ? "text-warning" : "text-muted-foreground"}`}>
              {strength === "weak" && "Use at least 8 characters"}
              {strength === "good" && "Good password"}
              {strength === "strong" && "Strong password"}
            </p>
          )}
        </div>
        <Button type="submit" variant="outline" className="auth-submit-btn w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
