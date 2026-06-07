import { useState } from "react";
import {
  useListUsers,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserCog,
  CheckCircle,
  XCircle,
  Trash2,
  ChevronDown,
  Loader2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGetAuthStatus } from "@workspace/api-client-react";

const ROLES = ["superuser", "admin", "client", "company", "employee", "agent"] as const;
type Role = (typeof ROLES)[number];

const ROLE_VARIANT: Record<Role, string> = {
  superuser: "bg-violet-100 text-violet-700 border-violet-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  client: "bg-cyan-100 text-cyan-700 border-cyan-200",
  company: "bg-teal-100 text-teal-700 border-teal-200",
  employee: "bg-lime-100 text-lime-700 border-lime-200",
  agent: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function UsersPage() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const { data: authData } = useGetAuthStatus({ query: { queryKey: ["/auth/me"], staleTime: 60_000 } });
  const myRole = (authData as { role?: string | null } | undefined)?.role ?? null;
  const myId = (authData as { userId?: number | null } | undefined)?.userId ?? null;

  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function setApproved(id: number, isApproved: boolean) {
    setBusy(id);
    try {
      await updateMutation.mutateAsync({ id, data: { isApproved } });
      await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } finally {
      setBusy(null);
    }
  }

  async function setRole(id: number, role: string) {
    setBusy(id);
    try {
      await updateMutation.mutateAsync({ id, data: { role } });
      await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } finally {
      setBusy(null);
    }
  }

  async function deleteUser(id: number) {
    setBusy(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } finally {
      setBusy(null);
      setPendingDelete(null);
    }
  }

  const allowedRoles = myRole === "superuser" ? ROLES : ROLES.filter((r) => r !== "superuser");

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserCog className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Approve accounts and manage roles</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-2xl border border-card-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users ?? []).map((u) => {
                const isMe = u.id === myId;
                const isBusy = busy === u.id;
                return (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    {/* User info */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {u.hasGoogleId && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <Shield className="h-3 w-3" /> Google
                        </span>
                      )}
                    </td>

                    {/* Role badge + picker */}
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={isMe || isBusy}>
                          <button
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${ROLE_VARIANT[u.role as Role] ?? "bg-secondary text-secondary-foreground border-secondary"} ${isMe ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 transition-opacity"}`}
                          >
                            {u.role}
                            {!isMe && <ChevronDown className="h-3 w-3 opacity-60" />}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {allowedRoles.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => setRole(u.id, r)}
                              className={r === u.role ? "font-semibold" : ""}
                            >
                              {r === u.role && "✓ "}{r}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>

                    {/* Approval status */}
                    <td className="px-4 py-3">
                      {u.isApproved ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <XCircle className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            {!u.isApproved && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setApproved(u.id, true)}
                              >
                                Approve
                              </Button>
                            )}
                            {u.isApproved && !isMe && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => setApproved(u.id, false)}
                              >
                                Revoke
                              </Button>
                            )}
                            {!isMe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => setPendingDelete({ id: u.id, name: u.name || u.email })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!isLoading && (users ?? []).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <UserCog className="h-8 w-8 opacity-40" />
              <p className="text-sm">No users yet</p>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {pendingDelete?.name}'s account and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteUser(pendingDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
