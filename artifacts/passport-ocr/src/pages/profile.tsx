import { useState } from "react";
import { useGetAuthStatus, useChangePassword } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, KeyRound, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  superuser: "Superuser",
  admin: "Admin",
  company: "Company",
  client: "Client",
  employee: "Employee",
  agent: "Agent",
};

export default function ProfilePage() {
  const { data: authData } = useGetAuthStatus({ query: { queryKey: ["/auth/me"], staleTime: 60_000 } });
  const user = authData as { name?: string | null; email?: string | null; role?: string | null } | undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-indigo-500/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative px-6 md:px-8 py-6 md:py-8">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-3.5 w-3.5 text-teal-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              My Account
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            View your account details and change your password.
          </p>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Account Information</h3>
              <p className="text-sm text-muted-foreground">Your name, email, and assigned role.</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Name</Label>
              <p className="text-sm font-medium">{user?.name ?? "—"}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email</Label>
              <p className="text-sm font-medium">{user?.email ?? "—"}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Role</Label>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "—"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const changePasswordMutation = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isPending = changePasswordMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must be identical.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "New password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({ data: { currentPassword, newPassword } });
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast({
        title: status === 401 ? "Incorrect password" : "Failed to change password",
        description:
          status === 401
            ? "The current password you entered is incorrect."
            : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Change Password</h3>
            <p className="text-sm text-muted-foreground">Update your login password.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                data-testid="input-current-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrent((v) => !v)}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                data-testid="input-new-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
              data-testid="button-change-password"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              )}
              Change Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
