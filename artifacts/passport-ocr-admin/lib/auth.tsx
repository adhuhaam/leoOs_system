import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuthStatusQueryKey,
  setAuthTokenGetter,
  useGetAuthStatus,
  useLogin,
  useRegister,
} from "@workspace/api-client-react";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type AuthUser = {
  id: number | null;
  name: string | null;
  email: string | null;
  role: string | null;
};

type AuthContextValue = {
  isLoading: boolean;
  isAuthed: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "leo_admin_session_token";
const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const ADMIN_ROLES = new Set(["admin", "superuser"]);

// expo-secure-store is only available on iOS/Android, not web.
// These helpers are silent no-ops on web so the rest of the code is uniform.
async function storeGet(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function storeSet(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value); } catch { /* web */ }
}
async function storeDelete(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch { /* web */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const [tokenReady, setTokenReady] = useState(false);
  const [forceLoggedOut, setForceLoggedOut] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const { data, isLoading: authLoading, refetch } = useGetAuthStatus({
    query: {
      queryKey: getGetAuthStatusQueryKey(),
      retry: false,
      staleTime: 30_000,
      enabled: tokenReady,
    },
  });

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  useEffect(() => {
    storeGet(TOKEN_KEY)
      .then((token) => {
        tokenRef.current = token;
        if (token) setAuthTokenGetter(() => token);
      })
      .finally(() => setTokenReady(true));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation.mutateAsync({ data: { email, password } });
      const token = (result as { token?: string })?.token;

      setAuthTokenGetter(null);
      tokenRef.current = null;
      await storeDelete(TOKEN_KEY);

      if (token) {
        tokenRef.current = token;
        await storeSet(TOKEN_KEY, token);
        setAuthTokenGetter(() => token);
      }

      setForceLoggedOut(false);
      qc.invalidateQueries();
      const { data: freshData } = await refetch();

      // ── Admin-only guard ──────────────────────────────────────────────────
      // LEO ADMIN is restricted to admin and superuser roles only.
      // If the logged-in user has any other role, force-logout immediately
      // and throw an error so the login screen can display it.
      const freshRole = (freshData as { role?: string | null } | undefined)?.role;
      if (!freshRole || !ADMIN_ROLES.has(freshRole)) {
        setForceLoggedOut(true);
        tokenRef.current = null;
        setAuthTokenGetter(null);
        await storeDelete(TOKEN_KEY);
        try {
          await fetch(`${BASE_URL}/api/auth/logout`, {
            method: "POST",
            credentials: "include",
          });
        } catch { /* ignore */ }
        qc.removeQueries({ predicate: () => true });
        throw Object.assign(
          new Error(
            "This app is for admin users only. Please use the LEO OS app instead.",
          ),
          { adminOnly: true },
        );
      }
    },
    [loginMutation, qc, refetch],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      await registerMutation.mutateAsync({ data: { email, password, name } });
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    setForceLoggedOut(true);

    const savedToken = tokenRef.current;
    tokenRef.current = null;
    setAuthTokenGetter(null);

    await storeDelete(TOKEN_KEY);

    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
      });
    } catch {
      // Ignore — client is already fully logged out.
    }

    qc.removeQueries({
      predicate: (q) => q.queryKey[0] !== "/api/auth/me",
    });
  }, [qc]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(() => {
    const raw = data as
      | {
          authenticated?: boolean;
          userId?: number | null;
          name?: string | null;
          email?: string | null;
          role?: string | null;
        }
      | undefined;

    const isAuthed = !forceLoggedOut && Boolean(raw?.authenticated);

    const user: AuthUser | null = isAuthed
      ? {
          id: raw?.userId ?? null,
          name: raw?.name ?? null,
          email: raw?.email ?? null,
          role: raw?.role ?? null,
        }
      : null;

    const isLoading = !tokenReady || authLoading;

    return { isLoading, isAuthed, user, login, register, logout, refresh };
  }, [tokenReady, authLoading, forceLoggedOut, data, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
