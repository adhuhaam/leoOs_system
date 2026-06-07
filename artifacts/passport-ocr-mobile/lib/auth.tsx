import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuthStatusQueryKey,
  useGetAuthStatus,
  useGoogleAuth,
  useLogin,
  useRegister,
} from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useMemo } from "react";

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
  loginWithGoogle: (idToken: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useGetAuthStatus({
    query: {
      queryKey: getGetAuthStatusQueryKey(),
      retry: false,
      staleTime: 30_000,
    },
  });

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const googleAuthMutation = useGoogleAuth();

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ data: { email, password } });
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

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      await googleAuthMutation.mutateAsync({ data: { idToken } });
      await qc.invalidateQueries();
      await refetch();
    },
    [googleAuthMutation, qc, refetch],
  );

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

    return { isLoading, isAuthed, user, login, register, loginWithGoogle, refresh };
  }, [isLoading, data, login, register, loginWithGoogle, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
