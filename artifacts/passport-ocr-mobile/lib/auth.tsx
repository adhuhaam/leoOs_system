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

  // tokenReady gates the auth query: we must load any stored Bearer token
  // from SecureStore BEFORE the first /auth/me request fires, otherwise a
  // returning user would briefly appear logged-out.
  const [tokenReady, setTokenReady] = useState(false);

  // enabled: tokenReady — query fires automatically once the SecureStore
  // check completes (no manual refetch() needed in a separate effect).
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

  // On mount: restore persisted session token from SecureStore and wire it
  // into the request getter so every subsequent API call sends the Bearer.
  useEffect(() => {
    storeGet(TOKEN_KEY)
      .then((token) => {
        if (token) setAuthTokenGetter(() => token);
      })
      .finally(() => setTokenReady(true));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      // POST /auth/login returns { token } — the session ID — directly in the
      // response body. React Native has no persistent cookie jar, so we store
      // the token in SecureStore and attach it as a Bearer on every request.
      const result = await loginMutation.mutateAsync({ data: { email, password } });
      const token = (result as { token?: string })?.token;

      // Clear any stale token first so the auth check uses fresh credentials.
      setAuthTokenGetter(null);
      await storeDelete(TOKEN_KEY);

      if (token) {
        await storeSet(TOKEN_KEY, token);
        setAuthTokenGetter(() => token);
      }

      // Refresh auth state (also wakes up all stale queries).
      qc.invalidateQueries();
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
    const storedToken = await storeGet(TOKEN_KEY);

    // 1. Synchronously mark as unauthenticated in the query cache FIRST.
    //    This prevents the AuthGate race condition where qc.clear() wipes the
    //    cache, triggers a background refetch, and a re-render between the
    //    clear and the refetch landing sees isAuthed=true → redirects to "/".
    qc.setQueryData(getGetAuthStatusQueryKey(), { authenticated: false });
    setAuthTokenGetter(null);

    // 2. Clear persisted token — client is now fully unauthenticated.
    await storeDelete(TOKEN_KEY);

    // 3. Tell the server to destroy the session (best-effort).
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
    } catch {
      // Ignore network errors — client state is already cleared.
    }

    // 4. Clear all other cached API data (passports, companies, etc.) so the
    //    next user doesn't see stale data.  Do NOT use qc.clear() — it would
    //    wipe the { authenticated: false } we just set and immediately trigger
    //    a refetch that could race against the login redirect.
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

    const isAuthed = Boolean(raw?.authenticated);

    const user: AuthUser | null = isAuthed
      ? {
          id: raw?.userId ?? null,
          name: raw?.name ?? null,
          email: raw?.email ?? null,
          role: raw?.role ?? null,
        }
      : null;

    // isLoading stays true until SecureStore is read AND the first auth
    // check has completed — prevents the AuthGate from flashing the login
    // screen for a returning user whose token is still being loaded.
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
