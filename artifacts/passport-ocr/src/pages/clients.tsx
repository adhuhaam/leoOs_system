import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useListPassports,
  useUpdatePassport,
  useDeletePassport,
  useListBillingDocuments,
  getListClientsQueryKey,
  getListPassportsQueryKey,
  getGetPassportStatsQueryKey,
} from "@workspace/api-client-react";
import type { Client, Passport, BillingDocumentSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Eye,
  Users,
  Receipt,
  FileText,
  UserMinus,
  Calendar,
} from "lucide-react";

interface ClientFormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  tin: string;
  notes: string;
}

const EMPTY_FORM: ClientFormState = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  tin: "",
  notes: "",
};

function clientToForm(c: Client): ClientFormState {
  return {
    name: c.name,
    contactPerson: c.contactPerson ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    tin: c.tin ?? "",
    notes: c.notes ?? "",
  };
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useListClients();

  // Cheap client-side search across the few fields the user is likely to recall.
  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contactPerson?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            Clients
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Companies and sites where candidates get placed. Use the &ldquo;Allocation&rdquo; field on a candidate to link them here.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-client">
          <Plus className="h-4 w-4 mr-1" /> Add client
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact, email, phone..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-clients"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filtered.length}</strong> of{" "}
              <strong className="text-foreground">{clients.length}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Contact Person</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="hidden xl:table-cell">TIN</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      {clients.length === 0
                        ? "No clients yet — click Add client to create your first one."
                        : "No clients match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} data-testid={`row-client-${c.id}`}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {c.contactPerson || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {c.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground font-mono">
                        {c.tin || <span className="font-sans">—</span>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              data-testid={`button-actions-client-${c.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setViewClient(c)}
                              data-testid={`menu-view-client-${c.id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setEditClient(c)}
                              data-testid={`menu-edit-client-${c.id}`}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteClient(c)}
                              data-testid={`menu-delete-client-${c.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewClient && (
        <ClientDetailDialog
          client={viewClient}
          open={!!viewClient}
          onOpenChange={(o) => !o && setViewClient(null)}
        />
      )}
      <ClientFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} />
      {editClient && (
        <ClientFormDialog
          mode="edit"
          client={editClient}
          open={!!editClient}
          onOpenChange={(o) => !o && setEditClient(null)}
        />
      )}
      {deleteClient && (
        <DeleteClientDialog
          client={deleteClient}
          open={!!deleteClient}
          onOpenChange={(o) => !o && setDeleteClient(null)}
        />
      )}
    </div>
  );
}

function ClientFormDialog(
  props:
    | { mode: "create"; open: boolean; onOpenChange: (o: boolean) => void }
    | { mode: "edit"; client: Client; open: boolean; onOpenChange: (o: boolean) => void },
) {
  const { mode, open, onOpenChange } = props;
  // Snapshot the initial form when the dialog opens (or when the target client
  // changes) so we never carry stale state between adds/edits.
  const initialKey = mode === "edit" ? `edit-${props.client.id}` : "create";
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const wantedKey = open ? initialKey : null;
  if (snapshotKey !== wantedKey) {
    setSnapshotKey(wantedKey);
    setForm(mode === "edit" ? clientToForm(props.client) : EMPTY_FORM);
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const onDone = (msg: string) => {
      toast({ title: msg });
      queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
      // Master List shows clientName via join — refresh it so renames propagate.
      queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
      onOpenChange(false);
    };

    if (mode === "create") {
      // On create, only send fields the user actually filled in — keeps the
      // generated payload small and avoids sending "" for fields they skipped.
      const createPayload: Record<string, string> = { name };
      (["contactPerson", "phone", "email", "address", "tin", "notes"] as const).forEach((k) => {
        const v = form[k].trim();
        if (v) createPayload[k] = v;
      });
      createMutation.mutate(
        { data: createPayload as unknown as Parameters<typeof createMutation.mutate>[0]["data"] },
        {
          onSuccess: () => onDone("Client added"),
          onError: () => toast({ title: "Failed to add client", variant: "destructive" }),
        },
      );
    } else {
      // On update, send nullable fields explicitly so blanking an input
      // actually clears the stored value (server treats null as "set to null").
      const updatePayload: Record<string, string | null> = { name };
      (["contactPerson", "phone", "email", "address", "tin", "notes"] as const).forEach((k) => {
        const v = form[k].trim();
        updatePayload[k] = v === "" ? null : v;
      });
      updateMutation.mutate(
        { id: props.client.id, data: updatePayload as unknown as Parameters<typeof updateMutation.mutate>[0]["data"] },
        {
          onSuccess: () => onDone("Client updated"),
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add client" : "Edit client"}</DialogTitle>
          <DialogDescription>
            Clients are the companies, sites, or sponsors a candidate is allocated to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                autoFocus
                data-testid="input-client-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm((s) => ({ ...s, contactPerson: e.target.value }))}
                data-testid="input-client-contact"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                data-testid="input-client-phone"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                data-testid="input-client-email"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                data-testid="input-client-address"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>TIN (Tax Identification Number)</Label>
              <Input
                placeholder="e.g. 1009905GST001"
                value={form.tin}
                onChange={(e) => setForm((s) => ({ ...s, tin: e.target.value }))}
                data-testid="input-client-tin"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                data-testid="input-client-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-client">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add client" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteClient();

  const onConfirm = () => {
    deleteMutation.mutate(
      { id: client.id },
      {
        onSuccess: () => {
          toast({ title: `${client.name} deleted` });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          // Allocated candidates get unlinked server-side — refresh master list.
          queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
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
          <AlertDialogTitle>Delete &ldquo;{client.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Any candidate currently allocated to this client will be unlinked
            (their other details are kept). This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-client"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// Helpers shared by client detail
// ============================================================================

function fmvr(n: string | number | null | undefined): string {
  if (n == null) return "MVR 0.00";
  const v = typeof n === "string" ? Number(n) : n;
  return `MVR ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fdate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

const DOC_STATUS_OPTS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "payment_received", label: "Payment Received" },
  { value: "completed", label: "Completed" },
];

function docStatusLabel(s: string): string {
  return DOC_STATUS_OPTS.find((o) => o.value === s)?.label ?? (s || "Draft");
}

function docStatusClass(s: string): string {
  switch (s) {
    case "sent":
      return "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-800";
    case "payment_received":
      return "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/40 dark:border-green-800";
    case "completed":
      return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800";
    default:
      return "text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/40 dark:border-slate-700";
  }
}

// ============================================================================
// ClientDetailDialog — tabs for Candidates + Invoices & Quotes
// ============================================================================

function ClientDetailDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [tab, setTab] = useState("candidates");
  const [editCandidate, setEditCandidate] = useState<Passport | null>(null);
  const [unlinkId, setUnlinkId] = useState<number | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clientIdStr = String(client.id);
  const { data: candidates = [], isLoading: candidatesLoading } = useListPassports(
    { clientId: clientIdStr },
    { query: { queryKey: getListPassportsQueryKey({ clientId: clientIdStr }) } },
  );

  const { data: invoices = [] } = useListBillingDocuments({ clientId: client.id });
  const { data: quotations = [] } = useListBillingDocuments({ clientId: client.id, kind: "quotation" });

  const clientDocs: BillingDocumentSummary[] = useMemo(() => {
    // Merge invoice + quotation results (both filtered server-side by clientId).
    // Also fall back to name matching for legacy docs created before clientId was stored.
    const byId = new Map<number, BillingDocumentSummary>();
    for (const d of [...invoices, ...quotations] as BillingDocumentSummary[]) {
      byId.set(d.id, d);
    }
    return [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [invoices, quotations]);

  const unlinkMutation = useUpdatePassport();
  const deleteCandidateMutation = useDeletePassport();

  const handleUnlink = (id: number) => {
    unlinkMutation.mutate(
      { id, data: { clientId: null } as Parameters<typeof unlinkMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "Candidate removed from client" });
          queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
          setUnlinkId(null);
        },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      },
    );
  };

  const handleDeleteCandidate = (id: number) => {
    deleteCandidateMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Candidate deleted" });
          queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPassportStatsQueryKey() });
          setDeleteCandidateId(null);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      },
    );
  };

  const pendingUnlink = candidates.find((p) => p.id === unlinkId);
  const pendingDeleteCandidate = candidates.find((p) => p.id === deleteCandidateId);

  const docsInvoiceCount = clientDocs.filter((d) => d.kind === "invoice").length;
  const docsQuoteCount = clientDocs.filter((d) => d.kind === "quotation").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Building className="h-5 w-5 text-primary" />
                {client.name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {[client.contactPerson, client.email, client.phone]
                  .filter(Boolean)
                  .join(" · ") || "No contact details on file"}
                {client.tin && (
                  <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    TIN {client.tin}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 pt-3 pb-0 flex-shrink-0 border-b">
              <TabsList className="h-9">
                <TabsTrigger value="candidates" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Candidates
                  <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {candidates.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="billing" className="gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />
                  Invoices &amp; Quotes
                  <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {clientDocs.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Candidates tab */}
            <TabsContent value="candidates" className="flex-1 overflow-y-auto m-0 focus-visible:outline-none">
              <div className="p-4">
                {candidatesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No candidates allocated to this client.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Open a candidate record and set its Allocation field to this client.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Passport #</TableHead>
                        <TableHead className="hidden md:table-cell">Nationality</TableHead>
                        <TableHead className="hidden lg:table-cell">Work Permit #</TableHead>
                        <TableHead className="hidden sm:table-cell">Expiry</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium uppercase">{p.fullName || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{p.passportNumber || "—"}</TableCell>
                          <TableCell className="capitalize hidden md:table-cell">{p.nationality || "—"}</TableCell>
                          <TableCell className="hidden lg:table-cell font-mono text-xs">
                            {p.workPermitNumber || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {p.dateOfExpiry || "—"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setEditCandidate(p)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit candidate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setUnlinkId(p.id)}>
                                  <UserMinus className="mr-2 h-4 w-4" /> Remove from client
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteCandidateId(p.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete candidate
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* Billing tab */}
            <TabsContent value="billing" className="flex-1 overflow-y-auto m-0 focus-visible:outline-none">
              <div className="p-4 space-y-3">
                {clientDocs.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No invoices or quotations for this client yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pb-1">
                      <span>
                        <span className="font-semibold text-foreground">{docsInvoiceCount}</span> invoice{docsInvoiceCount !== 1 ? "s" : ""}
                      </span>
                      <span>·</span>
                      <span>
                        <span className="font-semibold text-foreground">{docsQuoteCount}</span> quotation{docsQuoteCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {clientDocs.map((d) => {
                      const sub = Number(d.subtotal || 0);
                      const rate = Number(d.gstRate || 0);
                      const grand = d.gstInclusive ? sub : sub + (sub * rate) / 100;
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                                d.kind === "invoice"
                                  ? "bg-gradient-to-br from-indigo-500 to-violet-500"
                                  : "bg-gradient-to-br from-amber-500 to-orange-500"
                              }`}
                            >
                              {d.kind === "invoice" ? (
                                <Receipt className="h-4 w-4 text-white" />
                              ) : (
                                <FileText className="h-4 w-4 text-white" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold">{d.number}</span>
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${docStatusClass(d.status)}`}
                                >
                                  {docStatusLabel(d.status)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                <Calendar className="h-3 w-3" />
                                {fdate(d.issueDate)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="font-mono font-semibold text-sm tabular-nums">
                              {fmvr(grand)}
                            </span>
                            <Link href={`/billing/${d.id}/print`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="View / Print"
                                onClick={() => onOpenChange(false)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit candidate dialog */}
      {editCandidate && (
        <EditCandidateDialog
          passport={editCandidate}
          open={!!editCandidate}
          onOpenChange={(o) => !o && setEditCandidate(null)}
        />
      )}

      {/* Unlink confirm */}
      <AlertDialog open={unlinkId != null} onOpenChange={(o) => !o && setUnlinkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUnlink?.fullName || "This candidate"} will be unlinked from{" "}
              <strong>{client.name}</strong>. Their passport data is kept. You can re-allocate
              them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkId != null && handleUnlink(unlinkId)}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete candidate confirm */}
      <AlertDialog open={deleteCandidateId != null} onOpenChange={(o) => !o && setDeleteCandidateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <strong>{pendingDeleteCandidate?.fullName || "this candidate"}</strong> and all
              their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCandidateId != null && handleDeleteCandidate(deleteCandidateId)}
              disabled={deleteCandidateMutation.isPending}
            >
              {deleteCandidateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// EditCandidateDialog — edit key fields of a passport record
// ============================================================================

interface CandidateFormState {
  fullName: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  dateOfExpiry: string;
  dateOfIssue: string;
  workPermitNumber: string;
  agent: string;
}

function EditCandidateDialog({
  passport,
  open,
  onOpenChange,
}: {
  passport: Passport;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdatePassport();

  const [form, setForm] = useState<CandidateFormState>({
    fullName: passport.fullName ?? "",
    passportNumber: passport.passportNumber ?? "",
    nationality: passport.nationality ?? "",
    dateOfBirth: passport.dateOfBirth ?? "",
    dateOfIssue: passport.dateOfIssue ?? "",
    dateOfExpiry: passport.dateOfExpiry ?? "",
    workPermitNumber: passport.workPermitNumber ?? "",
    agent: passport.agent ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        id: passport.id,
        data: {
          fullName: form.fullName.trim() || undefined,
          passportNumber: form.passportNumber.trim() || undefined,
          nationality: form.nationality || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          dateOfIssue: form.dateOfIssue || undefined,
          dateOfExpiry: form.dateOfExpiry || undefined,
          workPermitNumber: form.workPermitNumber.trim() || null,
          agent: form.agent.trim() || null,
        } as Parameters<typeof updateMutation.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          toast({ title: "Candidate updated" });
          queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit Candidate</DialogTitle>
          <DialogDescription>
            Update passport details for{" "}
            <span className="font-medium">{passport.fullName || "this candidate"}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                placeholder="AHMED IBRAHIM"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Passport number</Label>
              <Input
                value={form.passportNumber}
                onChange={(e) => setForm((s) => ({ ...s, passportNumber: e.target.value }))}
                placeholder="A1234567"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Select
                value={form.nationality || "__none__"}
                onValueChange={(v) => setForm((s) => ({ ...s, nationality: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Not set —</SelectItem>
                  <SelectItem value="bangladesh">Bangladesh</SelectItem>
                  <SelectItem value="india">India</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date of birth</Label>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((s) => ({ ...s, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date of issue</Label>
              <Input
                type="date"
                value={form.dateOfIssue}
                onChange={(e) => setForm((s) => ({ ...s, dateOfIssue: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date of expiry</Label>
              <Input
                type="date"
                value={form.dateOfExpiry}
                onChange={(e) => setForm((s) => ({ ...s, dateOfExpiry: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Work permit number</Label>
              <Input
                value={form.workPermitNumber}
                onChange={(e) => setForm((s) => ({ ...s, workPermitNumber: e.target.value }))}
                placeholder="WP-12345"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Agent</Label>
              <Input
                value={form.agent}
                onChange={(e) => setForm((s) => ({ ...s, agent: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
