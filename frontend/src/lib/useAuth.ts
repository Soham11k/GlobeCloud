import { useEffect, useState } from "react";
import { getCachedUser, getSession, hydrateAuthFromStorage, type AuthUser } from "./auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrateAuthFromStorage();
    getSession().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading, isAuthenticated: !!user };
}
