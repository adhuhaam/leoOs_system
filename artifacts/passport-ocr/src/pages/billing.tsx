import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useListBillingDocuments,
  useCreateBillingDocument,
  useGetBillingDocument,
  useUpdateBillingDocument,
  useDeleteBillingDocument,
  useListCompanies,
  useListClients,
  getListBillingDocumentsQueryKey,
  getGetBillingDocumentQueryKey,
} from "@workspace/api-client-react";
import type {
  BillingDocumentSummary,
  BillingItemInput,
  Company,
  Client,
} from "@workspace/api-client-react";

// Issuing company is hardcoded to LEO Employment Services — resolved by name
// from the companies table so branding (letterhead, signature) remains editable
// in Settings.
const ISSUER_NAME = "LEO EMPLOYMENT SERVICES PVT LTD";
function resolveIssuerId(companies: Company[]): number | null {
  const found = companies.find(
    (c) => c.name.trim().toLowerCase() === ISSUER_NAME.toLowerCase(),
  );
  return found?.id ?? null;
}
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  FileText,
  Receipt,
  Eye,
  X,
  Calendar,
} from "lucide-react";

type Kind = "invoice" | "quotation";

function formatMVR(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "MVR 0.00";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "MVR 0.00";
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BillingPage() {
  // Tab persists in URL hash so links to "?invoices" / "?quotations" survive reloads.
  const initial: Kind = (() => {
    if (typeof window === "undefined") return "invoice";
    const h = window.location.hash.replace("#", "");
    return h === "quotation" ? "quotation" : "invoice";
  })();
  const [kind, setKind] = useState<Kind>(initial);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash !== `#${kind}`) {
      window.history.replaceState(null, "", `#${kind}`);
    }
  }, [kind]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: documents = [], isLoading } = useListBillingDocuments({ kind });
  const { data: companies = [] } = useListCompanies();
  const { data: clients = [] } = useListClients();
  const issuerId = resolveIssuerId(companies);
  const deleteMutation = useDeleteBillingDocument();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.number.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.companyName.toLowerCase().includes(q),
    );
  }, [documents, search]);

  // Totals on the kind-summary card
  const stats = useMemo(() => {
    const total = documents.reduce((s, d) => {
      const sub = Number(d.subtotal || 0);
      // Inclusive subtotals already contain GST; exclusive need it added.
      const rate = Number(d.gstRate || 0);
      const grand = d.gstInclusive ? sub : sub + (sub * rate) / 100;
      return s + grand;
    }, 0);
    return { count: documents.length, total };
  }, [documents]);

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
          setConfirmDeleteId(null);
          toast({ title: "Removed" });
        },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      },
    );
  };

  const pendingDelete = confirmDeleteId != null ? documents.find((d) => d.id === confirmDeleteId) : null;
  const accent = kind === "invoice" ? "indigo" : "amber";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <div
          className={`absolute inset-0 ${
            kind === "invoice"
              ? "bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-sky-500/10"
              : "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10"
          }`}
        />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative px-6 md:px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Receipt className={`h-3.5 w-3.5 text-${accent}-500`} />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                Billing
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Invoices &amp; Quotations
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl">
              Create invoices and quotations on company letterhead. Numbers auto-increment,
              GST is calculated for you, and every document has a print-ready preview.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => setCreateOpen(true)}
            data-testid="button-new-document"
            className="shadow-sm gap-2"
          >
            <Plus className="h-4 w-4" />
            New {kind === "invoice" ? "Invoice" : "Quotation"}
          </Button>
        </div>
      </div>

      {/* Tabs + summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="invoice" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-invoices">
              <Receipt className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="quotation" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-quotations">
              <FileText className="h-4 w-4" />
              Quotations
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground tabular-nums">{stats.count}</span> documents ·{" "}
            <span className="font-mono font-semibold text-foreground tabular-nums">{formatMVR(stats.total)}</span> total
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${kind === "invoice" ? "invoices" : "quotations"}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-billing"
        />
      </div>

      {/* List */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                {kind === "invoice" ? (
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No {kind === "invoice" ? "invoices" : "quotations"} yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Click <span className="font-medium">New {kind === "invoice" ? "Invoice" : "Quotation"}</span> to create your first one.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filtered.map((d) => (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  onEdit={() => setEditId(d.id)}
                  onDelete={() => setConfirmDeleteId(d.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      {createOpen && (
        <DocumentFormDialog
          mode="create"
          kind={kind}
          issuerId={issuerId}
          clients={clients}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {/* Edit dialog */}
      {editId != null && (
        <EditDocumentDialog
          id={editId}
          issuerId={issuerId}
          clients={clients}
          onClose={() => setEditId(null)}
        />
      )}

      <AlertDialog open={confirmDeleteId != null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.kind === "invoice" ? "invoice" : "quotation"}{" "}
              <span className="font-mono">{pendingDelete?.number}</span>?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document and all of its line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId != null && handleDelete(confirmDeleteId)}
              data-testid="button-confirm-delete-billing"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocumentRow({
  doc,
  onEdit,
  onDelete,
}: {
  doc: BillingDocumentSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sub = Number(doc.subtotal || 0);
  const rate = Number(doc.gstRate || 0);
  const grand = doc.gstInclusive ? sub : sub + (sub * rate) / 100;
  return (
    <div
      className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors group"
      data-testid={`row-billing-${doc.id}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            doc.kind === "invoice"
              ? "bg-gradient-to-br from-indigo-500 to-violet-500"
              : "bg-gradient-to-br from-amber-500 to-orange-500"
          }`}
        >
          {doc.kind === "invoice" ? (
            <Receipt className="h-5 w-5 text-white" />
          ) : (
            <FileText className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold tabular-nums">{doc.number}</span>
            <Badge variant="outline" className="h-5 text-[10px] font-medium uppercase tracking-wide">
              {doc.kind === "invoice" ? "Invoice" : "Quote"}
            </Badge>
          </div>
          <p className="text-sm font-medium truncate mt-0.5">{doc.customerName}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(doc.issueDate)}</span>
            <span>·</span>
            <span className="truncate">{doc.companyName}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 md:min-w-[280px]">
        <div className="text-right">
          <div className="text-base font-bold font-mono tabular-nums">{formatMVR(grand)}</div>
          {rate > 0 && (
            <div className="text-[10px] text-muted-foreground">
              GST {rate}% {doc.gstInclusive ? "incl" : "excl"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-100 md:opacity-60 md:group-hover:opacity-100 transition-opacity">
          <Link href={`/billing/${doc.id}/print`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="View / Print"
              data-testid={`button-print-${doc.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Edit"
            onClick={onEdit}
            data-testid={`button-edit-${doc.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Delete"
            onClick={onDelete}
            data-testid={`button-delete-${doc.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Form (used for both create + edit)
// ============================================================================

interface FormState {
  clientId: string; // "" = custom / manual entry
  customerName: string;
  customerAddress: string;
  customerTin: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  gstRate: string;
  gstInclusive: boolean;
  notes: string;
  items: { description: string; detail: string; qty: string; rate: string }[];
}

function emptyForm(kind: Kind): FormState {
  return {
    clientId: "",
    customerName: "",
    customerAddress: "",
    customerTin: "",
    issueDate: todayIso(),
    dueDate: kind === "invoice" ? todayIso() : "",
    terms: kind === "invoice" ? "Custom" : "",
    gstRate: kind === "invoice" ? "8" : "0",
    gstInclusive: true,
    notes:
      kind === "invoice"
        ? "Thank you.\nThis invoice is valid without a stamp or signature.\nAll payments shall be made in favor of Leo E. Services.\n\nBank: Maldives Islamic Bank\nAccount Number: 90101480044441000\nCurrency: MVR"
        : "Looking Forward in working with You in the future\n\nAll payments shall be made in favor of Leo E. Services.\n\nBank: Maldives Islamic Bank\nAccount Number: 90101480044441000",
    items: [{ description: "", detail: "", qty: "1", rate: "0" }],
  };
}

function calcLine(qty: string, rate: string): number {
  const q = Number(qty || 0);
  const r = Number(rate || 0);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return 0;
  return q * r;
}

function DocumentFormDialog({
  mode,
  kind,
  initial,
  documentId,
  issuerId,
  clients,
  open,
  onOpenChange,
}: {
  mode: "create" | "edit";
  kind: Kind;
  initial?: FormState;
  documentId?: number;
  issuerId: number | null;
  clients: Client[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateBillingDocument();
  const updateMutation = useUpdateBillingDocument();

  const [form, setForm] = useState<FormState>(initial ?? emptyForm(kind));

  const onPickClient = (v: string) => {
    if (v === "__custom__") {
      setForm((s) => ({ ...s, clientId: "" }));
      return;
    }
    const id = Number(v);
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setForm((s) => ({
      ...s,
      clientId: String(c.id),
      customerName: c.name,
      customerAddress: c.address ?? s.customerAddress,
    }));
  };

  const subtotal = form.items.reduce((s, it) => s + calcLine(it.qty, it.rate), 0);
  const gstRateNum = Number(form.gstRate || 0);
  const taxable = form.gstInclusive
    ? subtotal / (1 + gstRateNum / 100)
    : subtotal;
  const gstAmount = form.gstInclusive ? subtotal - taxable : (subtotal * gstRateNum) / 100;
  const grand = form.gstInclusive ? subtotal : subtotal + gstAmount;

  const setItem = (i: number, patch: Partial<FormState["items"][number]>) =>
    setForm((s) => ({
      ...s,
      items: s.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  const addItem = () =>
    setForm((s) => ({
      ...s,
      items: [...s.items, { description: "", detail: "", qty: "1", rate: "0" }],
    }));
  const removeItem = (i: number) =>
    setForm((s) => ({ ...s, items: s.items.filter((_, idx) => idx !== i) }));

  const handleSubmit = () => {
    if (!form.customerName.trim()) {
      toast({ title: "Bill To name is required", variant: "destructive" });
      return;
    }
    if (form.items.length === 0 || !form.items.some((it) => it.description.trim())) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    const items: BillingItemInput[] = form.items
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        detail: it.detail.trim() || undefined,
        qty: it.qty || "1",
        rate: it.rate || "0",
      }));

    if (mode === "create") {
      createMutation.mutate(
        {
          data: {
            kind,
            // Server resolves & overrides — value here is ignored.
            companyId: issuerId ?? 0,
            customerName: form.customerName.trim(),
            customerAddress: form.customerAddress.trim() || undefined,
            customerTin: form.customerTin.trim() || undefined,
            issueDate: form.issueDate,
            dueDate: form.dueDate || undefined,
            terms: form.terms.trim() || undefined,
            gstRate: form.gstRate || "0",
            gstInclusive: form.gstInclusive,
            notes: form.notes.trim() || undefined,
            items,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
            toast({ title: `${kind === "invoice" ? "Invoice" : "Quotation"} created` });
            onOpenChange(false);
          },
          onError: (err: unknown) => {
            const msg =
              (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
              "Please try again.";
            toast({ title: "Failed to create", description: msg, variant: "destructive" });
          },
        },
      );
    } else if (documentId != null) {
      updateMutation.mutate(
        {
          id: documentId,
          data: {
            customerName: form.customerName.trim(),
            customerAddress: form.customerAddress.trim() || null,
            customerTin: form.customerTin.trim() || null,
            issueDate: form.issueDate,
            dueDate: form.dueDate || null,
            terms: form.terms.trim() || null,
            gstRate: form.gstRate || "0",
            gstInclusive: form.gstInclusive,
            notes: form.notes.trim() || null,
            items,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBillingDocumentQueryKey(documentId) });
            toast({ title: "Updated" });
            onOpenChange(false);
          },
          onError: (err: unknown) => {
            const msg =
              (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
              "Please try again.";
            toast({ title: "Failed to update", description: msg, variant: "destructive" });
          },
        },
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New " : "Edit "}
            {kind === "invoice" ? "Invoice" : "Quotation"}
          </DialogTitle>
          <DialogDescription>
            Fill in the customer details, add line items, and we'll calculate totals automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Issuer banner + dates */}
          <div className="rounded-lg border border-border/60 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-sky-500/5 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Issued by
                </p>
                <p className="text-sm font-bold text-foreground mt-0.5">{ISSUER_NAME}</p>
              </div>
              <div className="flex gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Issue date</Label>
                  <Input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm((s) => ({ ...s, issueDate: e.target.value }))}
                    data-testid="input-issue-date"
                    className="h-9"
                  />
                </div>
                {kind === "invoice" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Due date</Label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
                      data-testid="input-due-date"
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bill to */}
          <div className="space-y-3 rounded-lg border border-border/60 p-4 bg-muted/20">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bill To
            </h4>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client</Label>
              <Select
                value={form.clientId || "__custom__"}
                onValueChange={onPickClient}
              >
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Pick a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">Custom (type details below)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Picking a client auto-fills the name and address. You can override either field after.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Customer name</Label>
                <Input
                  placeholder="Ayada Maldives"
                  value={form.customerName}
                  onChange={(e) => setForm((s) => ({ ...s, customerName: e.target.value }))}
                  data-testid="input-customer-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">TIN (optional)</Label>
                <Input
                  placeholder="1009905GST001"
                  value={form.customerTin}
                  onChange={(e) => setForm((s) => ({ ...s, customerTin: e.target.value }))}
                  data-testid="input-customer-tin"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Address (optional)</Label>
              <Textarea
                rows={2}
                placeholder="H. Aagadhage, 4th Floor&#10;Boduthakurufaanu Magu"
                value={form.customerAddress}
                onChange={(e) => setForm((s) => ({ ...s, customerAddress: e.target.value }))}
                data-testid="input-customer-address"
              />
            </div>
            {kind === "invoice" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Terms (optional)</Label>
                <Input
                  placeholder="Custom / Net 30 / Due on receipt"
                  value={form.terms}
                  onChange={(e) => setForm((s) => ({ ...s, terms: e.target.value }))}
                  data-testid="input-terms"
                />
              </div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Line items
              </h4>
              <Button type="button" size="sm" variant="outline" onClick={addItem} data-testid="button-add-item">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add line
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/60 p-3 space-y-2 bg-card"
                  data-testid={`item-row-${i}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                      {i + 1}
                    </span>
                    <Input
                      placeholder="Item / description"
                      value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                      className="flex-1"
                      data-testid={`input-item-desc-${i}`}
                    />
                    {form.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(i)}
                        data-testid={`button-remove-item-${i}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-start gap-2 pl-8">
                    <Textarea
                      rows={1}
                      placeholder="Optional sub-description (e.g. employee name, scope)"
                      value={it.detail}
                      onChange={(e) => setItem(i, { detail: e.target.value })}
                      className="flex-1 text-sm min-h-[36px]"
                      data-testid={`input-item-detail-${i}`}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-8">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Qty
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.qty}
                        onChange={(e) => setItem(i, { qty: e.target.value })}
                        className="h-8 text-sm tabular-nums"
                        data-testid={`input-item-qty-${i}`}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Rate
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={it.rate}
                        onChange={(e) => setItem(i, { rate: e.target.value })}
                        className="h-8 text-sm tabular-nums"
                        data-testid={`input-item-rate-${i}`}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Amount
                      </Label>
                      <div className="h-8 px-3 flex items-center text-sm font-mono tabular-nums font-semibold border border-border/60 rounded-md bg-muted/40">
                        {calcLine(it.qty, it.rate).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax + totals */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-border/60 p-4 bg-muted/20">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tax
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">GST rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.gstRate}
                    onChange={(e) => setForm((s) => ({ ...s, gstRate: e.target.value }))}
                    data-testid="input-gst-rate"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pricing</Label>
                  <Select
                    value={form.gstInclusive ? "incl" : "excl"}
                    onValueChange={(v) => setForm((s) => ({ ...s, gstInclusive: v === "incl" }))}
                  >
                    <SelectTrigger data-testid="select-gst-inclusive">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incl">Tax Inclusive</SelectItem>
                      <SelectItem value="excl">Tax Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-4 bg-gradient-to-br from-muted/40 to-muted/10 space-y-1.5">
              <Row label={form.gstInclusive ? "Sub Total (Tax Inclusive)" : "Sub Total"} value={subtotal} />
              {gstRateNum > 0 && (
                <>
                  <Row label="Total Taxable" value={taxable} muted />
                  <Row label={`GST (${gstRateNum}%)`} value={gstAmount} muted />
                </>
              )}
              <div className="border-t border-border/60 my-2" />
              <Row label="Total" value={grand} bold />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes (printed on the document)</Label>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              data-testid="input-notes"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-document">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "create" ? "Create" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span
        className={`${muted ? "text-muted-foreground" : "text-foreground"} ${bold ? "font-semibold" : ""}`}
      >
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${bold ? "text-lg font-bold" : ""} ${muted ? "text-muted-foreground" : ""}`}
      >
        {formatMVR(value)}
      </span>
    </div>
  );
}

// Wrapper that fetches the existing doc, transforms it into form state, and
// shows the form dialog in edit mode.
function EditDocumentDialog({
  id,
  issuerId,
  clients,
  onClose,
}: {
  id: number;
  issuerId: number | null;
  clients: Client[];
  onClose: () => void;
}) {
  const { data: doc, isLoading } = useGetBillingDocument(id);
  if (isLoading || !doc) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const matchedClient = clients.find(
    (c) => c.name.trim().toLowerCase() === doc.customerName.trim().toLowerCase(),
  );
  const initial: FormState = {
    clientId: matchedClient ? String(matchedClient.id) : "",
    customerName: doc.customerName,
    customerAddress: doc.customerAddress ?? "",
    customerTin: doc.customerTin ?? "",
    issueDate: doc.issueDate,
    dueDate: doc.dueDate ?? "",
    terms: doc.terms ?? "",
    gstRate: doc.gstRate,
    gstInclusive: doc.gstInclusive,
    notes: doc.notes ?? "",
    items:
      doc.items.length > 0
        ? doc.items.map((it) => ({
            description: it.description,
            detail: it.detail ?? "",
            qty: it.qty,
            rate: it.rate,
          }))
        : [{ description: "", detail: "", qty: "1", rate: "0" }],
  };

  return (
    <DocumentFormDialog
      mode="edit"
      kind={doc.kind as Kind}
      initial={initial}
      documentId={id}
      issuerId={issuerId}
      clients={clients}
      open
      onOpenChange={(o) => !o && onClose()}
    />
  );
}
