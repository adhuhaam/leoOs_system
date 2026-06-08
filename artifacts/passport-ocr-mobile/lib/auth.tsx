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

const TOKEN_KEY = "leo_session_token";
const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [tokenReady, setTokenReady] = useState(false);

  const { data, isLoading: authLoading, refetch } = useGetAuthStatus({
    query: {
      queryKey: getGetAuthStatusQueryKey(),
      retry: false,
      staleTime: 30_000,
      enabled: false,
    },
  });

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  // On mount: restore persisted session token from SecureStore
  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((token) => {
        if (token) {
          setAuthTokenGetter(() => token);
        }
      })
      .catch(() => {})
      .finally(() => setTokenReady(true));
  }, []);

  // Once the token getter is ready, trigger the auth status check
  useEffect(() => {
    if (tokenReady) {
      refetch();
    }
  }, [tokenReady, refetch]);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ data: { email, password } });

      // Fetch a durable session token so the login survives app restarts
      try {
        const res = await fetch(`${BASE_URL}/auth/mobile-token`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = (await res.json()) as { token?: string };
          if (json.token) {
            await SecureStore.setItemAsync(TOKEN_KEY, json.token);
            const t = json.token;
            setAuthTokenGetter(() => t);
          }
        }
      } catch {
        // Non-fatal — session cookie will work for this session
      }

      await qc.invalidateQueries();
      await refetch();
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
    const storedToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);

    // Tell the server to destroy the session (include Bearer so it destroys
    // the correct session, not a new one spawned from the cookie path)
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
    } catch {
      // Ignore network errors — clear client state regardless
    }

    // Clear all local auth state
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setAuthTokenGetter(null);
    qc.removeQueries({ queryKey: getGetAuthStatusQueryKey() });
    qc.clear();
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

    const isAuthed = Boolean(raw?.authenticated);

    const user: AuthUser | null = isAuthed
      ? {
          id: raw?.userId ?? null,
          name: raw?.name ?? null,
          email: raw?.email ?? null,
          role: raw?.role ?? null,
        }
      : null;

    // Keep isLoading true until the SecureStore token has been loaded so the
    // AuthGate doesn't briefly flash the login screen for returning users.
    const isLoading = !tokenReady || authLoading;

    return { isLoading, isAuthed, user, login, register, logout, refresh };
  }, [tokenReady, authLoading, data, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
