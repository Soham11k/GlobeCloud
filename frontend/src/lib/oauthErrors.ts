export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  redirect_mismatch:
    "Redirect URI mismatch. Register this exact callback URL in your Google/GitHub OAuth app:",
  invalid_client:
    "Invalid OAuth client credentials. Check GOOGLE_CLIENT_ID/SECRET or GITHUB_CLIENT_ID/SECRET in .env.",
  invalid_grant:
    "Authorization code expired or already used. Try signing in again.",
  invalid_state:
    "Session expired or invalid. Start sign-in again from the login page.",
  missing_code: "No authorization code received. Try signing in again.",
  missing_email:
    "Your account has no public email. Grant email access or use email/password sign-in.",
  missing_profile: "Could not read your profile from the provider.",
  access_denied: "Sign-in was cancelled.",
  unknown_provider: "Unknown sign-in provider.",
  provider_error: "Sign-in failed at the provider. Try again or use email/password.",
};

export function oauthErrorMessage(
  code: string | null,
  provider?: string | null,
  redirectUri?: string | null,
): string {
  const base = OAUTH_ERROR_MESSAGES[code ?? ""] ?? OAUTH_ERROR_MESSAGES.provider_error;
  if (code === "redirect_mismatch" && redirectUri) {
    return `${base} ${redirectUri}`;
  }
  if (code === "redirect_mismatch" && provider) {
    return `${OAUTH_ERROR_MESSAGES.redirect_mismatch} (see server OAUTH_REDIRECT_BASE_URL)/auth/oauth/callback/${provider}`;
  }
  return base;
}
