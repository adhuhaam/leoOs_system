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

  // forceLoggedOut overrides isAuthed to false immediately and synchronously
  // when logout() is called.  This is the definitive fix for the AuthGate race:
  // without this, the cache clear + refetch cycle has a window where isAuthed
  // is still true and the AuthGate redirects back to "/" from the login page.
  // We use React state (not cache manipulation) because state updates are
  // committed before the next effect run — guaranteed no render ever sees
  // isAuthed=true after setForceLoggedOut(true) has been called.
  const [forceLoggedOut, setForceLoggedOut] = useState(false);

  // Keep the current token in a ref so logout() can read it synchronously
  // (without an async storeGet() call) and include it in the server request.
  const tokenRef = useRef<string | null>(null);

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
        tokenRef.current = token;
        if (token) setAuthTokenGetter(() => token);
      })
      .finally(() => setTokenReady(true));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation.mutateAsync({ data: { email, password } });
      const token = (result as { token?: string })?.token;

      // Clear any stale token first.
      setAuthTokenGetter(null);
      tokenRef.current = null;
      await storeDelete(TOKEN_KEY);

      if (token) {
        tokenRef.current = token;
        await storeSet(TOKEN_KEY, token);
        setAuthTokenGetter(() => token);
      }

      // Re-enable auth check now that credentials are fresh.
      setForceLoggedOut(false);
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
    // ── Step 1: Override isAuthed to false RIGHT NOW ──────────────────────
    // This React state update is committed before any subsequent effect runs.
    // Every render after this point will see isAuthed=false regardless of what
    // the query cache contains.  This is the only reliable way to stop the
    // AuthGate from bouncing the user back to "/" during the logout async ops.
    setForceLoggedOut(true);

    // ── Step 2: Kill the Bearer synchronously so no in-flight request carries it ─
    const savedToken = tokenRef.current;
    tokenRef.current = null;
    setAuthTokenGetter(null);

    // ── Step 3: Clear persisted token (async, but state is already overridden) ──
    await storeDelete(TOKEN_KEY);

    // ── Step 4: Tell the server to invalidate the session (server-side only) ──
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: savedToken ? { Authorization: `Bearer ${savedToken}` } : {},
      });
    } catch {
      // Ignore — client is already fully logged out.
    }

    // ── Step 5: Flush cached data for the next user ───────────────────────
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

    // forceLoggedOut short-circuits any cache state — the very first render
    // after logout() is called will see isAuthed=false.
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
