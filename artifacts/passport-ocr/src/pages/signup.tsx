import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { register } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";
import leoLogo from "@assets/image_1778408412841.png";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    setError(null);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      setSuccess(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen w-full bg-app-shell flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="px-6 py-2 mb-6 flex items-center justify-center">
            <img
              src={leoLogo}
              alt="LEO Employment Services"
              className="w-full h-auto max-h-24 object-contain"
            />
          </div>
          <div className="rounded-2xl bg-card border border-card-border shadow-lg p-7 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-lg font-bold">Account requested</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account is pending admin approval. You'll be able to sign in once an administrator approves it.
            </p>
            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => navigate("/login")}
            >
              Back to sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-app-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="px-6 py-2 mb-6 flex items-center justify-center">
          <img
            src={leoLogo}
            alt="LEO Employment Services"
            className="w-full h-auto max-h-24 object-contain"
          />
        </div>

        <div className="rounded-2xl bg-card border border-card-border shadow-lg p-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Create account</h1>
              <p className="text-xs text-muted-foreground">Request access — admin approval required.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="form-signup">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full name
              </Label>
              <Input
                id="name"
                type="text"
                autoFocus
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={loading}
                data-testid="input-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                data-testid="input-password"
              />
            </div>

            {error && (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="text-signup-error"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !name || !email || !password}
              data-testid="button-submit-signup"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Requesting access…
                </>
              ) : (
                "Request access"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          LEO OS · Employment Operations
        </p>
      </div>
    </div>
  );
}
