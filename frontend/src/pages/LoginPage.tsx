import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { login, oauthUrl } from "@/lib/auth";
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
          <a
            href={oauthUrl("google")}
            className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/5"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </a>
        )}
        {providers.includes("github") && (
          <a
            href={oauthUrl("github")}
            className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2.5 text-sm text-white hover:bg-white/5"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.935 1.05-.105 2.16-.54 2.16-2.175 0-.495-.18-.9-.495-1.23-.48-.51-1.05-.735-1.05-1.485 0-.375.015-.75.03-1.05.48-.09 1.47-.48 1.47-1.935 0-.435-.135-.75-.33-1.02-.03-.075-.285-.735.03-1.53.27.09.885.27 1.635 1.02.48-.27 1.05-.405 1.59-.405.54 0 1.11.135 1.59.405.75-.765 1.365-.93 1.635-1.02.315.795.06 1.455.03 1.53-.195.27-.33.585-.33 1.02 0 1.455.99 1.845 1.47 1.935.015.3.03.675.03 1.05 0 .75-.57.975-1.05 1.485-.315.33-.495.735-.495 1.23 0 1.635 1.11 2.07 2.16 2.175-.51.525-1.095 1.59-1.23 1.935-.24.675-1.02 1.965-4.035 1.41 0 1.005-.015 1.95-.015 2.235 0 .315.225.675.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        )}
      </div>
    </>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Access write controls and save your session.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50">Email</label>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/50">Password</label>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <OAuthButtons />

      <p className="mt-8 text-center text-sm text-white/45">
        No account?{" "}
        <Link to="/signup" className="text-[var(--accent,#5b52ff)] hover:underline">
          Create one
        </Link>
        {" · "}
        <Link to="/app" className="text-white/60 hover:underline">
          Browse as guest
        </Link>
      </p>
    </AuthLayout>
  );
}
