import { Button } from "@/components/ui/button";
import { oauthUrl } from "@/lib/auth";
import { useProduct } from "@/lib/hooks";

const PROVIDERS = [
  { id: "google" as const, label: "Google" },
  { id: "github" as const, label: "GitHub" },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function OAuthSetupHint() {
  const { data: product } = useProduct();
  const base = product?.oauth_redirect_base_url?.replace(/\/$/, "") ?? window.location.origin;
  const alt = base.includes("127.0.0.1")
    ? base.replace("127.0.0.1", "localhost")
    : base.replace("localhost", "127.0.0.1");

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">OAuth setup (one-time)</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4">
        <li>
          In Google Cloud Console → Credentials → OAuth client, add{" "}
          <strong>both</strong> redirect URIs (localhost and 127.0.0.1 are different):
          <ul className="mt-1 list-disc pl-4 font-mono text-[10px]">
            <li>{base}/auth/oauth/callback/google</li>
            <li>{alt}/auth/oauth/callback/google</li>
          </ul>
        </li>
        <li>Set GOOGLE_CLIENT_ID/SECRET and GITHUB_CLIENT_ID/SECRET in .env</li>
        <li>
          Set <code className="font-mono text-[10px]">OAUTH_REDIRECT_BASE_URL={base}</code> and include both origins in{" "}
          <code className="font-mono text-[10px]">CORS_ORIGINS</code>
        </li>
      </ol>
    </div>
  );
}

type Props = {
  inviteToken?: string;
};

export function AuthOAuth({ inviteToken }: Props) {
  const { data: product } = useProduct();
  const configured = new Set(product?.oauth_providers ?? []);
  const inviteQuery = inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : "";
  const isDev = import.meta.env.DEV;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 max-sm:grid-cols-1 sm:grid-cols-2">
        {PROVIDERS.map(({ id, label }) => {
          const isOn = configured.has(id);
          const icon = id === "google" ? <GoogleIcon /> : <GitHubIcon />;
          return isOn ? (
            <Button key={id} variant="outline" className="auth-oauth-btn w-full" asChild>
              <a href={`${oauthUrl(id)}${inviteQuery}`}>
                {icon}
                Continue with {label}
              </a>
            </Button>
          ) : (
            <Button
              key={id}
              variant="outline"
              className="auth-oauth-btn w-full"
              disabled
              aria-describedby={`oauth-${id}-hint`}
            >
              {icon}
              {label}
            </Button>
          );
        })}
      </div>
      {!configured.size && isDev && <OAuthSetupHint />}
      {!configured.size && !isDev && (
        <p id="oauth-google-hint" className="mt-2 text-center text-xs text-muted-foreground">
          Social sign-in is not configured on this deployment.
        </p>
      )}
    </>
  );
}
