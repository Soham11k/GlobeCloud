let accessToken: string | null = null;
let userCache: AuthUser | null = null;

const TOKEN_KEY = "globecloud_access_token";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  has_password: boolean;
};

export function hydrateAuthFromStorage(): void {
  if (accessToken) return;
  const stored = sessionStorage.getItem(TOKEN_KEY);
  if (stored) accessToken = stored;
}

export function getAccessToken(): string | null {
  if (!accessToken) hydrateAuthFromStorage();
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
  if (!token) userCache = null;
}

export function getCachedUser(): AuthUser | null {
  return userCache;
}

function persistSession(data: { access_token: string; user: AuthUser }) {
  accessToken = data.access_token;
  userCache = data.user;
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === "string" ? detail.detail : "Login failed");
  }
  const data = await res.json();
  persistSession(data);
  return data.user;
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<AuthUser> {
  const res = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === "string" ? detail.detail : "Registration failed");
  }
  const data = await res.json();
  persistSession(data);
  return data.user;
}

export async function refreshSession(): Promise<AuthUser | null> {
  const res = await fetch("/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const data = await res.json();
  persistSession(data);
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
  setAccessToken(null);
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getAccessToken();
  if (!token) return null;
  const res = await fetch("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const user = await res.json();
  userCache = user;
  return user;
}

export async function getSession(): Promise<AuthUser | null> {
  hydrateAuthFromStorage();
  if (userCache && accessToken) return userCache;
  if (accessToken) {
    const me = await fetchMe();
    if (me) return me;
  }
  return refreshSession();
}

export function oauthUrl(provider: "google" | "github"): string {
  return `/auth/oauth/${provider}`;
}
