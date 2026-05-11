import { useEffect, useMemo, useState } from "react";
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

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
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
  Users,
  ShieldCheck,
  X,
  ChevronsUpDown,
  Plus as PlusIcon,
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

const AVATAR_PALETTE = [
  { bg: "bg-rose-100 dark:bg-rose-950/40", fg: "text-rose-700 dark:text-rose-300", ring: "ring-rose-200/60 dark:ring-rose-900/40" },
  { bg: "bg-amber-100 dark:bg-amber-950/40", fg: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200/60 dark:ring-amber-900/40" },
  { bg: "bg-emerald-100 dark:bg-emerald-950/40", fg: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200/60 dark:ring-emerald-900/40" },
  { bg: "bg-sky-100 dark:bg-sky-950/40", fg: "text-sky-700 dark:text-sky-300", ring: "ring-sky-200/60 dark:ring-sky-900/40" },
  { bg: "bg-violet-100 dark:bg-violet-950/40", fg: "text-violet-700 dark:text-violet-300", ring: "ring-violet-200/60 dark:ring-violet-900/40" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-950/40", fg: "text-fuchsia-700 dark:text-fuchsia-300", ring: "ring-fuchsia-200/60 dark:ring-fuchsia-900/40" },
  { bg: "bg-teal-100 dark:bg-teal-950/40", fg: "text-teal-700 dark:text-teal-300", ring: "ring-teal-200/60 dark:ring-teal-900/40" },
  { bg: "bg-orange-100 dark:bg-orange-950/40", fg: "text-orange-700 dark:text-orange-300", ring: "ring-orange-200/60 dark:ring-orange-900/40" },
];

function colorFor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initialsFor(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: Password[] }>();
    for (const e of filtered) {
      const key = e.website.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.items.push(e);
      else map.set(key, { label: e.website, items: [e] });
    }
    for (const g of map.values()) {
      g.items.sort((a, b) => a.owner.localeCompare(b.owner));
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered]);

  const websiteCount = useMemo(
    () => new Set(entries.map((e) => e.website.toLowerCase())).size,
    [entries],
  );
  const ownerCount = useMemo(
    () => new Set(entries.map((e) => e.owner.toLowerCase())).size,
    [entries],
  );

  const websiteOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      const key = e.website.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, e.website.trim());
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6 md:p-8">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <KeyRound className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Password Vault
              </h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-xl">
                A shared, searchable cabinet for every account your team uses — websites, dashboards, mailboxes, anything with a login.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => setAddOpen(true)}
            data-testid="button-add-password"
            className="self-start md:self-center shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add password
          </Button>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          <StatTile icon={ShieldCheck} label="Entries" value={entries.length} tint="text-primary" />
          <StatTile icon={Globe} label="Websites" value={websiteCount} tint="text-sky-600 dark:text-sky-400" />
          <StatTile icon={Users} label="Owners" value={ownerCount} tint="text-violet-600 dark:text-violet-400" />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by website, owner, or username…"
          className="pl-10 pr-10 h-12 text-base shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-passwords"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {search && (
        <p className="text-xs text-muted-foreground -mt-3">
          Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
          <strong className="text-foreground">{entries.length}</strong> entries.
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState hasEntries={entries.length > 0} onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => {
            const palette = colorFor(group.label.toLowerCase());
            return (
              <div key={group.label}>
                <div className="flex items-center gap-2.5 mb-2.5 px-1">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${palette.bg} ${palette.fg}`}
                  >
                    {initialsFor(group.label)}
                  </span>
                  <h3 className="font-semibold text-sm tracking-tight">{group.label}</h3>
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                    {group.items.length}
                  </Badge>
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
            );
          })}
        </div>
      )}

      <PasswordFormDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        websiteOptions={websiteOptions}
      />
      {editEntry && (
        <PasswordFormDialog
          mode="edit"
          entry={editEntry}
          open={!!editEntry}
          onOpenChange={(o) => !o && setEditEntry(null)}
          websiteOptions={websiteOptions}
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

function StatTile({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof KeyRound;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur px-3 py-3 md:px-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tint}`} />
        <span className="font-medium">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function EmptyState({ hasEntries, onAdd }: { hasEntries: boolean; onAdd: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-14 text-center flex flex-col items-center gap-3">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-base">
            {hasEntries ? "No matches" : "Your vault is empty"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {hasEntries
              ? "Try a different search term — websites, owners, and usernames are all searchable."
              : "Save the first credential to share with the team. Everyone signed in here will see it."}
          </p>
        </div>
        {!hasEntries && (
          <Button onClick={onAdd} className="mt-2">
            <Plus className="h-4 w-4 mr-1.5" /> Add your first password
          </Button>
        )}
      </CardContent>
    </Card>
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
  const palette = colorFor(entry.owner.toLowerCase());

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
      className="group relative rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
      data-testid={`row-password-${entry.id}`}
    >
      <div className="flex items-stretch gap-3 p-3 md:p-4">
        <div
          className={`flex h-10 w-10 md:h-11 md:w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${palette.bg} ${palette.fg} ${palette.ring}`}
        >
          {initialsFor(entry.owner)}
        </div>

        <div className="flex-1 min-w-0 grid sm:grid-cols-[1fr_1fr_auto] items-center gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Owner
            </div>
            <div className="text-sm font-semibold truncate">{entry.owner}</div>
          </div>

          <div className="min-w-0 grid sm:grid-cols-2 gap-3">
            <FieldDisplay
              label="Username"
              value={entry.username}
              onCopy={() => copy(entry.username, "username")}
              copied={copied === "username"}
              testId={`button-copy-username-${entry.id}`}
            />
            <FieldDisplay
              label="Password"
              value={revealed ? entry.password : "•".repeat(Math.min(Math.max(entry.password.length, 6), 14))}
              mono
              onCopy={() => copy(entry.password, "password")}
              copied={copied === "password"}
              testId={`button-copy-password-${entry.id}`}
              extra={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => setRevealed((r) => !r)}
                  data-testid={`button-toggle-password-${entry.id}`}
                  title={revealed ? "Hide" : "Show"}
                  aria-label={revealed ? "Hide password" : "Show password"}
                >
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              }
            />
          </div>

          <div className="flex items-center gap-1 self-start sm:self-center">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              data-testid={`button-edit-password-${entry.id}`}
              title="Edit"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40"
              onClick={onDelete}
              data-testid={`button-delete-password-${entry.id}`}
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldDisplay({
  label,
  value,
  mono,
  onCopy,
  copied,
  testId,
  extra,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  copied: boolean;
  testId?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={`text-sm truncate ${mono ? "font-mono tracking-tight" : ""}`}>
          {value}
        </span>
        {extra}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={onCopy}
          data-testid={testId}
          title={`Copy ${label.toLowerCase()}`}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function WebsiteCombobox({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const exactMatch = options.some(
    (o) => o.toLowerCase() === trimmed.toLowerCase(),
  );
  const showAddNew = trimmed.length > 0 && !exactMatch;
  const palette = value ? colorFor(value.toLowerCase()) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
          data-testid="combobox-password-website"
        >
          <span className="flex items-center gap-2 min-w-0">
            {value && palette ? (
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold ${palette.bg} ${palette.fg}`}
              >
                {initialsFor(value)}
              </span>
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>
              {value || "Pick or add a website / app…"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or type a new one…"
            value={query}
            onValueChange={setQuery}
            data-testid="combobox-input-website"
          />
          <CommandList>
            {options.length === 0 && !trimmed && (
              <CommandEmpty>
                No saved websites yet — type one to add it.
              </CommandEmpty>
            )}
            {options.length > 0 && (
              <CommandGroup heading="Existing">
                {options.map((opt) => {
                  const p = colorFor(opt.toLowerCase());
                  return (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={() => {
                        onChange(opt);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${p.bg} ${p.fg}`}
                      >
                        {initialsFor(opt)}
                      </span>
                      <span className="truncate">{opt}</span>
                      {value.toLowerCase() === opt.toLowerCase() && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {showAddNew && (
              <>
                {options.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Add new">
                  <CommandItem
                    value={`__add__${trimmed}`}
                    onSelect={() => {
                      onChange(trimmed);
                      setQuery("");
                      setOpen(false);
                    }}
                    data-testid="combobox-add-new-website"
                  >
                    <PlusIcon className="h-4 w-4 text-primary" />
                    <span>
                      Use &ldquo;<strong>{trimmed}</strong>&rdquo; as new
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PasswordFormDialog(
  props:
    | { mode: "create"; open: boolean; onOpenChange: (o: boolean) => void; websiteOptions: string[] }
    | { mode: "edit"; entry: Password; open: boolean; onOpenChange: (o: boolean) => void; websiteOptions: string[] },
) {
  const { mode, open, onOpenChange, websiteOptions } = props;
  const entryId = mode === "edit" ? props.entry.id : null;
  const [form, setForm] = useState<PasswordFormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" ? pwdToForm(props.entry) : EMPTY_FORM);
    setShowPassword(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, entryId]);

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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {mode === "create" ? "Add a new password" : "Edit password"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Saved entries are visible to everyone signed in to LEO OS.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pwd-website">Website / application</Label>
            <WebsiteCombobox
              id="pwd-website"
              value={form.website}
              onChange={(v) => setForm((s) => ({ ...s, website: v }))}
              options={websiteOptions}
            />
            <p className="text-[11px] text-muted-foreground">
              Pick from your existing websites or type a new one to add it.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pwd-owner">Owner</Label>
              <Input
                id="pwd-owner"
                value={form.owner}
                onChange={(e) => setForm((s) => ({ ...s, owner: e.target.value }))}
                placeholder="Whose account"
                data-testid="input-password-owner"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-username">Username</Label>
              <Input
                id="pwd-username"
                value={form.username}
                onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                placeholder="Username or email"
                autoComplete="off"
                data-testid="input-password-username"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd-value">Password</Label>
            <div className="flex gap-2">
              <Input
                id="pwd-value"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                autoComplete="new-password"
                className="font-mono"
                data-testid="input-password-value"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Hide" : "Show"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-password">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Save password" : "Save changes"}
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
