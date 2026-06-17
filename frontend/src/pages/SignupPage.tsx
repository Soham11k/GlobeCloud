import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { register, oauthUrl } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProduct } from "@/lib/hooks";
import { toast } from "sonner";

function OAuthButtons() {
  const { data: product } = useProduct();
  const providers = product?.oauth_providers ?? [];
  if (providers.length === 0) return null;

  return (
    <>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[var(--surface-0,#03030a)] px-2 text-white/40">or continue with</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {providers.includes("google") && (
          <a href={oauthUrl("google")} className="flex items-center justify-center rounded-md border border-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/5">
            Google
          </a>
        )}
        {providers.includes("github") && (
          <a href={oauthUrl("github")} className="flex items-center justify-center rounded-md border border-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/5">
            GitHub
          </a>
        )}
      </div>
    </>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Account created");
      navigate("/app", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create account" subtitle="Full write access to catalog, orders, and agent.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-white/5 text-white" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50">Email</label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="border-white/10 bg-white/5 text-white" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50">Password</label>
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="border-white/10 bg-white/5 text-white" />
          <p className="text-xs text-white/35">At least 8 characters</p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>

      <OAuthButtons />

      <p className="mt-8 text-center text-sm text-white/45">
        Already have an account?{" "}
        <Link to="/login" className="text-[var(--accent,#5b52ff)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
