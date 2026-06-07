import { useRef, useState } from "react";
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
  Ban,
  ShieldOff,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

const ROLES = [
  "superuser",
  "admin",
  "client",
  "company",
  "employee",
  "agent",
] as const;
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
  const { data: authData } = useGetAuthStatus({
    query: { queryKey: ["/auth/me"], staleTime: 60_000 },
  });
  const myRole =
    (authData as { role?: string | null } | undefined)?.role ?? null;
  const myId =
    (authData as { userId?: number | null } | undefined)?.userId ?? null;

  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [editingLinked, setEditingLinked] = useState<number | null>(null);
  const [linkedValue, setLinkedValue] = useState("");
  const linkedInputRef = useRef<HTMLInputElement>(null);

  async function mutate(id: number, data: Record<string, unknown>) {
    setBusy(id);
    try {
      await updateMutation.mutateAsync({ id, data: data as Parameters<typeof updateMutation.mutateAsync>[0]["data"] });
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

  function startEditLinked(id: number, current: string | null | undefined) {
    setEditingLinked(id);
    setLinkedValue(current ?? "");
    setTimeout(() => linkedInputRef.current?.focus(), 0);
  }

  async function saveLinked(id: number) {
    await mutate(id, { linkedEntityId: linkedValue.trim() || null });
    setEditingLinked(null);
  }

  const allowedRoles =
    myRole === "superuser"
      ? ROLES
      : ROLES.filter((r) => r !== "superuser");

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserCog className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Approve, block, and manage roles for all accounts
          </p>
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
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">
                  Entity ID
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
                const isBlocked = (u as { isBlocked?: boolean }).isBlocked ?? false;

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    {/* User info */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {u.name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {u.email}
                      </div>
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
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              ROLE_VARIANT[u.role as Role] ??
                              "bg-secondary text-secondary-foreground border-secondary"
                            } ${isMe ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 transition-opacity"}`}
                          >
                            {u.role}
                            {!isMe && (
                              <ChevronDown className="h-3 w-3 opacity-60" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {allowedRoles.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => mutate(u.id, { role: r })}
                              className={r === u.role ? "font-semibold" : ""}
                            >
                              {r === u.role && "✓ "}
                              {r}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                          <Ban className="h-3.5 w-3.5" /> Blocked
                        </span>
                      ) : u.isApproved ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <XCircle className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </td>

                    {/* Linked Entity ID — inline editable */}
                    <td className="px-4 py-3 max-w-[140px]">
                      {editingLinked === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            ref={linkedInputRef}
                            value={linkedValue}
                            onChange={(e) => setLinkedValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveLinked(u.id);
                              if (e.key === "Escape") setEditingLinked(null);
                            }}
                            className="h-6 w-24 text-xs border border-border rounded px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="entity id"
                          />
                          <button
                            onClick={() => saveLinked(u.id)}
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-emerald-50 text-emerald-600"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingLinked(null)}
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span className="text-xs text-muted-foreground truncate max-w-[90px]">
                            {u.linkedEntityId || (
                              <span className="opacity-40">—</span>
                            )}
                          </span>
                          {!isMe && (
                            <button
                              onClick={() =>
                                startEditLinked(u.id, u.linkedEntityId)
                              }
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-opacity"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            {/* Approve (only when pending and not blocked) */}
                            {!u.isApproved && !isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => mutate(u.id, { isApproved: true })}
                              >
                                Approve
                              </Button>
                            )}
                            {/* Revoke (only when approved and not blocked and not me) */}
                            {u.isApproved && !isBlocked && !isMe && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => mutate(u.id, { isApproved: false })}
                              >
                                Revoke
                              </Button>
                            )}
                            {/* Block / Unblock */}
                            {!isMe && !isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                                onClick={() => mutate(u.id, { isBlocked: true })}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Block
                              </Button>
                            )}
                            {!isMe && isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => mutate(u.id, { isBlocked: false })}
                              >
                                <ShieldOff className="h-3 w-3 mr-1" />
                                Unblock
                              </Button>
                            )}
                            {/* Delete */}
                            {!isMe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  setPendingDelete({
                                    id: u.id,
                                    name: u.name || u.email,
                                  })
                                }
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
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {pendingDelete?.name}'s account and
              cannot be undone.
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
