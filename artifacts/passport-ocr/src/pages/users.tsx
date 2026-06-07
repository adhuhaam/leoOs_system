import { useRef, useState } from "react";
import {
  useListUsers,
  useUpdateUser,
  useCreateUser,
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
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetAuthStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

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

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  isApproved: boolean;
  isBlocked?: boolean;
  linkedEntityId?: string | null;
  hasPassword?: boolean;
  hasGoogleId?: boolean;
  createdAt: string;
};

// ---------- Add User dialog ----------
type AddForm = {
  email: string;
  name: string;
  role: Role;
  password: string;
  linkedEntityId: string;
  isApproved: boolean;
};

const ADD_DEFAULTS: AddForm = {
  email: "",
  name: "",
  role: "agent",
  password: "",
  linkedEntityId: "",
  isApproved: true,
};

// ---------- Edit User dialog ----------
type EditForm = {
  name: string;
  role: Role;
  linkedEntityId: string;
  newPassword: string;
};

export default function UsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: users, isLoading } = useListUsers();
  const { data: authData } = useGetAuthStatus({
    query: { queryKey: ["/auth/me"], staleTime: 60_000 },
  });
  const myRole =
    (authData as { role?: string | null } | undefined)?.role ?? null;
  const myId =
    (authData as { userId?: number | null } | undefined)?.userId ?? null;

  const updateMutation = useUpdateUser();
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();

  // row-level busy spinner
  const [busy, setBusy] = useState<number | null>(null);

  // delete confirm
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // inline entity-id edit
  const [editingLinked, setEditingLinked] = useState<number | null>(null);
  const [linkedValue, setLinkedValue] = useState("");
  const linkedInputRef = useRef<HTMLInputElement>(null);

  // add-user dialog
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(ADD_DEFAULTS);
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // edit-user dialog
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    role: "agent",
    linkedEntityId: "",
    newPassword: "",
  });
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const allowedRoles =
    myRole === "superuser"
      ? ROLES
      : ROLES.filter((r) => r !== "superuser");

  // ── helpers ──────────────────────────────────────────────────────────────

  async function mutate(id: number, data: Record<string, unknown>) {
    setBusy(id);
    try {
      await updateMutation.mutateAsync({
        id,
        data: data as Parameters<typeof updateMutation.mutateAsync>[0]["data"],
      });
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

  // ── Add user ─────────────────────────────────────────────────────────────

  function openAdd() {
    setAddForm(ADD_DEFAULTS);
    setAddError("");
    setShowAdd(true);
  }

  async function submitAdd() {
    if (!addForm.email.trim() || !addForm.name.trim() || !addForm.password) {
      setAddError("Email, name and password are required.");
      return;
    }
    if (addForm.password.length < 6) {
      setAddError("Password must be at least 6 characters.");
      return;
    }
    setAddBusy(true);
    setAddError("");
    try {
      await createMutation.mutateAsync({
        data: {
          email: addForm.email.trim(),
          name: addForm.name.trim(),
          role: addForm.role,
          password: addForm.password,
          isApproved: addForm.isApproved,
          linkedEntityId: addForm.linkedEntityId.trim() || null,
        },
      });
      await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setShowAdd(false);
      toast({ title: "User created", description: addForm.email.trim() });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to create user";
      setAddError(msg);
    } finally {
      setAddBusy(false);
    }
  }

  // ── Edit user ─────────────────────────────────────────────────────────────

  function openEdit(u: UserRow) {
    setEditTarget(u);
    setEditForm({
      name: u.name ?? "",
      role: (u.role as Role) ?? "agent",
      linkedEntityId: u.linkedEntityId ?? "",
      newPassword: "",
    });
    setEditError("");
  }

  async function submitEdit() {
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      setEditError("Name is required.");
      return;
    }
    if (editForm.newPassword && editForm.newPassword.length < 6) {
      setEditError("Password must be at least 6 characters.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: {
          name: editForm.name.trim(),
          role: editForm.role,
          linkedEntityId: editForm.linkedEntityId.trim() || null,
          newPassword: editForm.newPassword || null,
        },
      });
      await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setEditTarget(null);
      toast({ title: "User updated" });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to update user";
      setEditError(msg);
    } finally {
      setEditBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCog className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              User Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Create, approve, block, and manage roles
            </p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add User
        </Button>
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
              {(users as UserRow[] ?? []).map((u) => {
                const isMe = u.id === myId;
                const isBusy = busy === u.id;
                const isBlocked = u.isBlocked ?? false;

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

                    {/* Role badge + quick-picker dropdown */}
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
                            {/* Edit details */}
                            {!isMe && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openEdit(u)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            {/* Approve */}
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
                            {/* Revoke */}
                            {u.isApproved && !isBlocked && !isMe && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() =>
                                  mutate(u.id, { isApproved: false })
                                }
                              >
                                Revoke
                              </Button>
                            )}
                            {/* Block */}
                            {!isMe && !isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                                onClick={() =>
                                  mutate(u.id, { isBlocked: true })
                                }
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Block
                              </Button>
                            )}
                            {/* Unblock */}
                            {!isMe && isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() =>
                                  mutate(u.id, { isBlocked: false })
                                }
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

      {/* ── Add User Dialog ───────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) setShowAdd(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder="user@example.com"
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-name">Full Name</Label>
                <Input
                  id="add-name"
                  placeholder="John Doe"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-role">Role</Label>
                <Select
                  value={addForm.role}
                  onValueChange={(v) =>
                    setAddForm((f) => ({ ...f, role: v as Role }))
                  }
                >
                  <SelectTrigger id="add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-linked">Entity ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="add-linked"
                  placeholder="link to company/client"
                  value={addForm.linkedEntityId}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      linkedEntityId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-password">Password</Label>
                <Input
                  id="add-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={addForm.password}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  id="add-approved"
                  type="checkbox"
                  checked={addForm.isApproved}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      isApproved: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="add-approved" className="cursor-pointer font-normal">
                  Approve account immediately
                </Label>
              </div>
            </div>
            {addError && (
              <p className="text-xs text-destructive">{addError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdd(false)}
              disabled={addBusy}
            >
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={addBusy}>
              {addBusy && (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              )}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit — {editTarget?.name || editTarget?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) =>
                    setEditForm((f) => ({ ...f, role: v as Role }))
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-linked">Entity ID</Label>
                <Input
                  id="edit-linked"
                  placeholder="optional"
                  value={editForm.linkedEntityId}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      linkedEntityId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-password">
                  New Password{" "}
                  <span className="text-muted-foreground font-normal">
                    (leave blank to keep current)
                  </span>
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={editForm.newPassword}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      newPassword: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {editError && (
              <p className="text-xs text-destructive">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editBusy}
            >
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={editBusy}>
              {editBusy && (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────── */}
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
