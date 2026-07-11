import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  getClient,
  sendAuthCode,
  verifyAuthCode,
  clearAuthToken,
  getUserIdentity,
  isConvexConfigured,
  hasAuthToken,
} from "../lib/convex";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isDemo: boolean;
  sendCode: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  demoLogin: () => void;
  logout: () => void;
  /** Whether Convex is configured (the auth flow needs it) */
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [isConfigured] = useState(isConvexConfigured);

  // On mount, check for existing auth token and recover the session
  useEffect(() => {
    async function restoreSession() {
      if (!isConvexConfigured()) {
        setLoading(false);
        return;
      }

      if (!hasAuthToken()) {
        setLoading(false);
        return;
      }

      try {
        const identity = await getUserIdentity();
        if (identity) {
          setUser({
            id: identity.subject,
            email: identity.email,
            name: identity.name || identity.email.split("@")[0] || "User",
          });
        }
      } catch {
        // Token expired or invalid — clean up
        clearAuthToken();
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const sendCode = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      if (!isConvexConfigured()) {
        return { ok: false, error: "Convex is not configured. Add VITE_CONVEX_URL to your env." };
      }
      return sendAuthCode(email);
    },
    [],
  );

  const verifyCode = useCallback(
    async (email: string, code: string): Promise<{ ok: boolean; error?: string }> => {
      if (!isConvexConfigured()) {
        return { ok: false, error: "Convex is not configured" };
      }

      const result = await verifyAuthCode(email, code);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      // Fetch the user identity to build the user object
      try {
        const identity = await getUserIdentity();
        if (identity) {
          setUser({
            id: identity.subject,
            email: identity.email,
            name: identity.name || identity.email.split("@")[0] || "User",
          });
        }
      } catch {
        // Token is valid but identity fetch failed — still logged in
        setUser({ id: email, email, name: email.split("@")[0] });
      }

      return { ok: true };
    },
    [],
  );

  const demoLogin = useCallback(() => {
    setUser({
      id: "demo-user",
      email: "demo@observeai.demo",
      name: "Demo Reviewer",
    });
    setIsDemo(true);
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setIsDemo(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, sendCode, verifyCode, demoLogin, logout, isConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}