import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPasswords,
  useCreatePassword,
  useUpdatePassword,
  useDeletePassword,
  getListPasswordsQueryKey,
} from "@workspace/api-client-react";
import type { Password } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  KeyRound,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  Globe,
} from "lucide-react";

interface PasswordFormState {
  website: string;
  owner: string;
  username: string;
  password: string;
}

const EMPTY_FORM: PasswordFormState = {
  website: "",
  owner: "",
  username: "",
  password: "",
};

function pwdToForm(p: Password): PasswordFormState {
  return {
    website: p.website,
    owner: p.owner,
    username: p.username,
    password: p.password,
  };
}

export default function PasswordsPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Password | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Password | null>(null);

  const { data: entries = [], isLoading } = useListPasswords();

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.website.toLowerCase().includes(q) ||
        e.owner.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q),
    );
  }, [entries, search]);

  // Group by website (case-insensitive); preserve original casing of first
  // occurrence as the group label.
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: Password[] }>();
    for (const e of filtered) {
      const key = e.website.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.items.push(e);
      else map.set(key, { label: e.website, items: [e] });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            Passwords
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Shared password vault for the team — websites, apps, and login credentials.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-password">
          <Plus className="h-4 w-4 mr-1" /> Add password
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by website, owner, or username..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-passwords"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filtered.length}</strong> of{" "}
              <strong className="text-foreground">{entries.length}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {entries.length === 0
                ? "No passwords saved yet — click Add password to create your first entry."
                : "No entries match your search."}
            </div>
          ) : (
            <div className="divide-y">
              {grouped.map((group) => (
                <div key={group.label} className="p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm tracking-tight">{group.label}</h3>
                    <span className="text-xs text-muted-foreground">
                      ({group.items.length})
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {group.items.map((e) => (
                      <PasswordRow
                        key={e.id}
                        entry={e}
                        onEdit={() => setEditEntry(e)}
                        onDelete={() => setDeleteEntry(e)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PasswordFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} />
      {editEntry && (
        <PasswordFormDialog
          mode="edit"
          entry={editEntry}
          open={!!editEntry}
          onOpenChange={(o) => !o && setEditEntry(null)}
        />
      )}
      {deleteEntry && (
        <DeletePasswordDialog
          entry={deleteEntry}
          open={!!deleteEntry}
          onOpenChange={(o) => !o && setDeleteEntry(null)}
        />
      )}
    </div>
  );
}

function PasswordRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: Password;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  const copy = async (value: string, kind: "username" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1200);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div
      className="border rounded-lg p-3 md:p-4 bg-card hover:bg-muted/30 transition"
      data-testid={`row-password-${entry.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
            {entry.owner}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Username
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm break-all">{entry.username}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => copy(entry.username, "username")}
                  data-testid={`button-copy-username-${entry.id}`}
                  title="Copy username"
                >
                  {copied === "username" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Password
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm break-all">
                  {revealed ? entry.password : "•".repeat(Math.min(entry.password.length, 12))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => setRevealed((r) => !r)}
                  data-testid={`button-toggle-password-${entry.id}`}
                  title={revealed ? "Hide" : "Show"}
                >
                  {revealed ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => copy(entry.password, "password")}
                  data-testid={`button-copy-password-${entry.id}`}
                  title="Copy password"
                >
                  {copied === "password" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
            data-testid={`button-edit-password-${entry.id}`}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid={`button-delete-password-${entry.id}`}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PasswordFormDialog(
  props:
    | { mode: "create"; open: boolean; onOpenChange: (o: boolean) => void }
    | { mode: "edit"; entry: Password; open: boolean; onOpenChange: (o: boolean) => void },
) {
  const { mode, open, onOpenChange } = props;
  const initialKey = mode === "edit" ? `edit-${props.entry.id}` : "create";
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);
  const [form, setForm] = useState<PasswordFormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const wantedKey = open ? initialKey : null;
  if (snapshotKey !== wantedKey) {
    setSnapshotKey(wantedKey);
    setForm(mode === "edit" ? pwdToForm(props.entry) : EMPTY_FORM);
    setShowPassword(false);
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePassword();
  const updateMutation = useUpdatePassword();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const website = form.website.trim();
    const owner = form.owner.trim();
    const username = form.username.trim();
    const password = form.password;
    if (!website || !owner || !username || !password) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    const onDone = (msg: string) => {
      toast({ title: msg });
      queryClient.invalidateQueries({ queryKey: getListPasswordsQueryKey() });
      onOpenChange(false);
    };

    if (mode === "create") {
      createMutation.mutate(
        { data: { website, owner, username, password } },
        {
          onSuccess: () => onDone("Password added"),
          onError: () => toast({ title: "Failed to add password", variant: "destructive" }),
        },
      );
    } else {
      updateMutation.mutate(
        { id: props.entry.id, data: { website, owner, username, password } },
        {
          onSuccess: () => onDone("Password updated"),
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add password" : "Edit password"}</DialogTitle>
          <DialogDescription>
            All four fields are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Website / application *</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm((s) => ({ ...s, website: e.target.value }))}
              placeholder="e.g. Gmail, Office 365, leomaldives.com"
              autoFocus
              data-testid="input-password-website"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Owner *</Label>
            <Input
              value={form.owner}
              onChange={(e) => setForm((s) => ({ ...s, owner: e.target.value }))}
              placeholder="Who this account belongs to"
              data-testid="input-password-owner"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Username *</Label>
            <Input
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
              autoComplete="off"
              data-testid="input-password-username"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password *</Label>
            <div className="flex gap-2">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                autoComplete="new-password"
                data-testid="input-password-value"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-password">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add password" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePasswordDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: Password;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeletePassword();

  const onConfirm = () => {
    deleteMutation.mutate(
      { id: entry.id },
      {
        onSuccess: () => {
          toast({ title: "Password deleted" });
          queryClient.invalidateQueries({ queryKey: getListPasswordsQueryKey() });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this password?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the {entry.owner} entry for{" "}
            <strong>{entry.website}</strong>. This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-password"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
