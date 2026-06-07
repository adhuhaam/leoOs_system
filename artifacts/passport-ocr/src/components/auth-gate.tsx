import { type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useGetAuthStatus } from "@workspace/api-client-react";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import { Button } from "@/components/ui/button";

/**
 * Gates the entire app behind a session check.
 * - While loading → spinner
 * - When `/auth/me` succeeds with `authenticated: false` → render Login
 * - When the request fails transiently (network, 5xx) → show retry UI; we do
 *   NOT bounce the user to login on flaky network, since `/auth/me` always
 *   returns 200 for the authenticated check itself
 * - When authenticated → render children
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, refetch, isFetching } = useGetAuthStatus({
    query: {
      queryKey: ["/auth/me"],
      retry: 2,
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-app-shell">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-app-shell px-4">
        <div className="max-w-sm rounded-xl border border-card-border bg-card p-6 text-center shadow">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-3 text-base font-semibold">Couldn’t reach the server</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button className="mt-4" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (data?.authenticated !== true) {
    // Allow unauthenticated access to the signup page
    if (typeof window !== "undefined" && window.location.pathname.endsWith("/signup")) {
      return <SignupPage />;
    }
    return <LoginPage />;
  }

  return <>{children}</>;
}
