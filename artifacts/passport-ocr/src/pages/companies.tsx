import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useListLoaOptions,
  useCreateLoaOption,
  useUpdateLoaOption,
  useDeleteLoaOption,
  getListCompaniesQueryKey,
  getListLoaOptionsQueryKey,
} from "@workspace/api-client-react";
import type { Company, LoaOption } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Eye,
  Briefcase,
  MapPin,
  Hammer,
  Check,
  X,
  Image as ImageIcon,
  Upload,
  Save,
  Globe,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024; // 10 MB raw input cap (before compression)
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;    // 1.5 MB target for the compressed output
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const LOA_CATEGORIES = [
  {
    category: "job_title" as const,
    label: "Job Titles",
    description: "Roles / occupations selectable in the LOA form.",
    icon: Briefcase,
    accent: "from-indigo-500 to-violet-500",
    placeholder: "e.g. Construction Worker",
  },
  {
    category: "work_type" as const,
    label: "Work Types",
    description: "Type of work (manual, technical, supervisory…).",
    icon: Hammer,
    accent: "from-amber-500 to-orange-500",
    placeholder: "e.g. Manual Labour",
  },
  {
    category: "work_site" as const,
    label: "Work Sites",
    description: "Project locations or employment sites.",
    icon: MapPin,
    accent: "from-emerald-500 to-teal-500",
    placeholder: "e.g. Guraidhoo, Maldives",
  },
] as const;

type LoaCategory = "job_title" | "work_type" | "work_site";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compresses an image file and uploads it directly as multipart/form-data to
 * POST /api/companies/:id/branding.  Multipart bypasses proxy JSON body-size
 * limits that silently reject large base64 payloads in production.
 */
async function uploadBrandingImage(
  companyId: number,
  kind: "letterheadImage" | "signatureImage",
  file: File,
): Promise<void> {
  const objectUrl = URL.createObjectURL(file);
  const blob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_W = 1200, MAX_H = 800;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_W || h > MAX_H) {
        const scale = Math.min(MAX_W / w, MAX_H / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const MAX_BLOB = MAX_IMAGE_BYTES;
      const step = (q: number) => {
        canvas.toBlob((b) => {
          if (!b) { reject(new Error("Encoding failed")); return; }
          if (b.size <= MAX_BLOB || q <= 0.3) resolve(b);
          else step(Math.round((q - 0.15) * 100) / 100);
        }, "image/jpeg", q);
      };
      step(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not load image")); };
    img.src = objectUrl;
  });

  const fieldName = kind === "letterheadImage" ? "letterhead" : "signature";
  const fd = new FormData();
  fd.append(fieldName, blob, "image.jpg");

  const res = await fetch(`/api/companies/${companyId}/branding`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Upload failed");
    throw new Error(text);
  }
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface CompanyFormState {
  name: string;
  address: string;
  email: string;
  phone: string;
  country: string;
  registrationNumber: string;
  signatoryName: string;
  signatoryDesignation: string;
}

const EMPTY_FORM: CompanyFormState = {
  name: "",
  address: "",
  email: "",
  phone: "",
  country: "",
  registrationNumber: "",
  signatoryName: "",
  signatoryDesignation: "",
};

function companyToForm(c: Company): CompanyFormState {
  return {
    name: c.name ?? "",
    address: c.address ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    country: c.country ?? "",
    registrationNumber: c.registrationNumber ?? "",
    signatoryName: c.signatoryName ?? "",
    signatoryDesignation: c.signatoryDesignation ?? "",
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [viewCompany, setViewCompany] = useState<Company | null>(null);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const { data: companies = [], isLoading } = useListCompanies();

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.registrationNumber?.toLowerCase().includes(q),
    );
  }, [companies, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Companies
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage employer companies, their LOA options (job titles, work types, sites) and branding.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-company">
          <Plus className="h-4 w-4 mr-1" /> Add company
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, reg. number…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-companies"
              />
            </div>
            <span className="text-sm text-muted-foreground shrink-0">
              <strong className="text-foreground">{filtered.length}</strong> of{" "}
              <strong className="text-foreground">{companies.length}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="hidden xl:table-cell">Country</TableHead>
                  <TableHead className="hidden xl:table-cell">Reg. No.</TableHead>
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
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {companies.length === 0
                        ? "No companies yet — click Add company to get started."
                        : "No companies match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => setViewCompany(c)}
                      data-testid={`row-company-${c.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Building2 className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            {c.signatoryName && (
                              <p className="text-xs text-muted-foreground">{c.signatoryName}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
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
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {c.country ? (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {c.country}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground font-mono">
                        {c.registrationNumber || <span className="font-sans">—</span>}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => setEditCompany(c)}
                            data-testid={`button-edit-company-${c.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                data-testid={`button-actions-company-${c.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setViewCompany(c)}
                                data-testid={`menu-view-company-${c.id}`}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setEditCompany(c)}
                                data-testid={`menu-edit-company-${c.id}`}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(c)}
                                data-testid={`menu-delete-company-${c.id}`}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewCompany && (
        <CompanyDetailDialog
          company={viewCompany}
          open={!!viewCompany}
          onOpenChange={(o) => !o && setViewCompany(null)}
          onEdit={(c) => { setViewCompany(null); setEditCompany(c); }}
        />
      )}

      <CompanyFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} />

      {editCompany && (
        <CompanyFormDialog
          mode="edit"
          company={editCompany}
          open={!!editCompany}
          onOpenChange={(o) => !o && setEditCompany(null)}
        />
      )}

      {deleteTarget && (
        <DeleteCompanyDialog
          company={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Add / Edit form dialog ───────────────────────────────────────────────────

function CompanyFormDialog(
  props:
    | { mode: "create"; open: boolean; onOpenChange: (o: boolean) => void }
    | { mode: "edit"; company: Company; open: boolean; onOpenChange: (o: boolean) => void },
) {
  const { mode, open, onOpenChange } = props;
  const initialKey = mode === "edit" ? `edit-${props.company.id}` : "create";
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM);
  const wantedKey = open ? initialKey : null;
  if (snapshotKey !== wantedKey) {
    setSnapshotKey(wantedKey);
    setForm(mode === "edit" ? companyToForm(props.company) : EMPTY_FORM);
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allCompanies = [] } = useListCompanies();
  const liveCompany = mode === "edit"
    ? (allCompanies.find((c) => c.id === props.company.id) ?? props.company)
    : null;

  const { data: brandedCompanies = [] } = useListCompanies(
    { withBranding: true },
    { query: { enabled: mode === "edit", queryKey: getListCompaniesQueryKey({ withBranding: true }) } },
  );
  const brandingData = mode === "edit"
    ? (brandedCompanies.find((c) => c.id === props.company.id) ?? null)
    : null;

  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  // Branding uploads get their own mutation so they don't share isPending state
  // with the form save — avoids disabling upload buttons while the form saves
  // and stops the "Save changes" spinner from appearing on image upload.
  const brandingMutation = useUpdateCompany();
  const [brandingUploading, setBrandingUploading] = useState(false);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const f = (key: keyof CompanyFormState) => (v: string) =>
    setForm((s) => ({ ...s, [key]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const onDone = (msg: string) => {
      toast({ title: msg });
      queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      onOpenChange(false);
    };

    if (mode === "create") {
      const payload: Record<string, string> = { name };
      (["address","email","phone","country","registrationNumber","signatoryName","signatoryDesignation"] as const)
        .forEach((k) => { const v = form[k].trim(); if (v) payload[k] = v; });
      createMutation.mutate(
        { data: payload as unknown as Parameters<typeof createMutation.mutate>[0]["data"] },
        {
          onSuccess: () => onDone("Company added"),
          onError: () => toast({ title: "Failed to add company", variant: "destructive" }),
        },
      );
    } else {
      const payload: Record<string, string | null> = { name };
      (["address","email","phone","country","registrationNumber","signatoryName","signatoryDesignation"] as const)
        .forEach((k) => { const v = form[k].trim(); payload[k] = v === "" ? null : v; });
      updateMutation.mutate(
        { id: props.company.id, data: payload as Parameters<typeof updateMutation.mutate>[0]["data"] },
        {
          onSuccess: () => onDone("Company updated"),
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add company" : "Edit company"}</DialogTitle>
          <DialogDescription>
            Companies are employers you generate Letters of Appointment for.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Company name *</Label>
              <Input
                value={form.name}
                onChange={(e) => f("name")(e.target.value)}
                autoFocus
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => f("phone")(e.target.value)} data-testid="input-company-phone" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => f("email")(e.target.value)} data-testid="input-company-email" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => f("address")(e.target.value)} data-testid="input-company-address" />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => f("country")(e.target.value)} placeholder="e.g. Maldives" data-testid="input-company-country" />
            </div>
            <div className="space-y-1.5">
              <Label>Registration number</Label>
              <Input value={form.registrationNumber} onChange={(e) => f("registrationNumber")(e.target.value)} data-testid="input-company-regno" />
            </div>
            <div className="space-y-1.5">
              <Label>Signatory name</Label>
              <Input value={form.signatoryName} onChange={(e) => f("signatoryName")(e.target.value)} data-testid="input-company-signatory-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Signatory designation</Label>
              <Input value={form.signatoryDesignation} onChange={(e) => f("signatoryDesignation")(e.target.value)} data-testid="input-company-signatory-desig" />
            </div>
          </div>

          {mode === "edit" && liveCompany && (() => {
            const handleImageUpload = async (kind: "letterheadImage" | "signatureImage", file: File | null) => {
              if (!file) return;
              if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                toast({ title: "PNG or JPG only", variant: "destructive" });
                return;
              }
              if (file.size > MAX_RAW_FILE_BYTES) {
                toast({ title: "Image must be under 10 MB", variant: "destructive" });
                return;
              }
              setBrandingUploading(true);
              try {
                await uploadBrandingImage(liveCompany.id, kind, file);
                queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
                queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey({ withBranding: true }) });
                toast({ title: kind === "letterheadImage" ? "Letterhead saved" : "Signature saved" });
              } catch (err) {
                toast({ title: err instanceof Error ? err.message : "Failed to save image", variant: "destructive" });
              } finally {
                setBrandingUploading(false);
              }
            };
            const handleImageClear = (kind: "letterheadImage" | "signatureImage") => {
              brandingMutation.mutateAsync(
                { id: liveCompany.id, data: { [kind]: null } as Parameters<typeof brandingMutation.mutate>[0]["data"] },
              ).then(() => {
                queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
                queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey({ withBranding: true }) });
                toast({ title: "Image removed" });
              }).catch(() => toast({ title: "Failed to remove", variant: "destructive" }));
            };
            return (
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 pt-1">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" /> Branding
                  {brandingUploading && (
                    <span className="text-[10px] text-muted-foreground animate-pulse ml-1">Saving…</span>
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <ImageSlot
                    label="Letterhead"
                    hint="PNG/JPG · auto-compressed · appears at top of LOA prints"
                    dataUrl={brandingData?.letterheadImage ?? null}
                    onPick={(f) => handleImageUpload("letterheadImage", f)}
                    onClear={() => handleImageClear("letterheadImage")}
                    previewClass="h-28"
                    testId={`edit-letterhead-${liveCompany.id}`}
                    disabled={brandingUploading}
                  />
                  <ImageSlot
                    label="Signature"
                    hint="PNG/JPG · auto-compressed · printed above signatory name"
                    dataUrl={brandingData?.signatureImage ?? null}
                    onPick={(f) => handleImageUpload("signatureImage", f)}
                    onClear={() => handleImageClear("signatureImage")}
                    previewClass="h-28"
                    testId={`edit-signature-${liveCompany.id}`}
                    disabled={brandingUploading}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Images save immediately when selected.</p>
              </div>
            );
          })()}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-company">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add company" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteCompanyDialog({
  company,
  open,
  onOpenChange,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteCompany();

  const onConfirm = () => {
    deleteMutation.mutate(
      { id: company.id },
      {
        onSuccess: () => {
          toast({ title: `${company.name} deleted` });
          queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
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
          <AlertDialogTitle>Delete &ldquo;{company.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Any candidates assigned to this company will be unlinked (their passport data is kept).
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-company"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Company detail dialog ────────────────────────────────────────────────────

function CompanyDetailDialog({
  company,
  open,
  onOpenChange,
  onEdit,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (c: Company) => void;
}) {
  const [tab, setTab] = useState("info");
  const { data: allCompanies = [] } = useListCompanies();
  const liveCompany = allCompanies.find((c) => c.id === company.id) ?? company;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold leading-tight">{liveCompany.name}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {[liveCompany.address, liveCompany.country].filter(Boolean).join(" · ") || "No address on record"}
            </DialogDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => onEdit(liveCompany)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mb-0 w-fit">
            <TabsTrigger value="info">Info &amp; Branding</TabsTrigger>
            <TabsTrigger value="job_title">Job Titles</TabsTrigger>
            <TabsTrigger value="work_type">Work Types</TabsTrigger>
            <TabsTrigger value="work_site">Work Sites</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <TabsContent value="info" className="mt-0 space-y-6">
              <CompanyInfoPanel company={liveCompany} />
            </TabsContent>

            {(["job_title", "work_type", "work_site"] as const).map((cat) => {
              const cfg = LOA_CATEGORIES.find((c) => c.category === cat)!;
              return (
                <TabsContent key={cat} value={cat} className="mt-0">
                  <OptionList companyId={company.id} cfg={cfg} />
                </TabsContent>
              );
            })}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Info panel (read-only overview + branding) ───────────────────────────────

function CompanyInfoPanel({ company }: { company: Company }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateCompany = useUpdateCompany();
  const [brandingUploading, setBrandingUploading] = useState(false);

  const { data: brandedCompanies = [] } = useListCompanies(
    { withBranding: true },
    { query: { queryKey: getListCompaniesQueryKey({ withBranding: true }) } },
  );
  const brandingData = brandedCompanies.find((c) => c.id === company.id) ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey({ withBranding: true }) });
  };

  const handleBrandingUpload = async (
    kind: "letterheadImage" | "signatureImage",
    file: File | null,
  ) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "PNG or JPG only", variant: "destructive" });
      return;
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      toast({ title: "Image must be under 10 MB", variant: "destructive" });
      return;
    }
    setBrandingUploading(true);
    try {
      await uploadBrandingImage(company.id, kind, file);
      invalidate();
      toast({ title: "Image saved" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save image", variant: "destructive" });
    } finally {
      setBrandingUploading(false);
    }
  };

  const handleBrandingClear = (kind: "letterheadImage" | "signatureImage") => {
    updateCompany.mutate(
      { id: company.id, data: { [kind]: null } },
      {
        onSuccess: () => { invalidate(); toast({ title: "Image removed" }); },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      },
    );
  };

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Phone", value: company.phone },
    { label: "Email", value: company.email },
    { label: "Country", value: company.country },
    { label: "Registration No.", value: company.registrationNumber },
    { label: "Signatory Name", value: company.signatoryName },
    { label: "Signatory Designation", value: company.signatoryDesignation },
  ];

  return (
    <div className="space-y-5">
      {/* Key details grid */}
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm font-medium truncate">{value || <span className="text-muted-foreground font-normal">—</span>}</p>
          </div>
        ))}
        {company.address && (
          <div className="col-span-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Address</p>
            <p className="text-sm">{company.address}</p>
          </div>
        )}
      </div>

      {/* Branding */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-muted-foreground" /> Branding
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ImageSlot
            label="Letterhead"
            hint="PNG/JPG · auto-compressed · used at top of LOA PDF"
            dataUrl={brandingData?.letterheadImage ?? null}
            onPick={(f) => handleBrandingUpload("letterheadImage", f)}
            onClear={() => handleBrandingClear("letterheadImage")}
            previewClass="h-28"
            testId={`letterhead-${company.id}`}
            disabled={brandingUploading || updateCompany.isPending}
          />
          <ImageSlot
            label="Signature"
            hint="PNG/JPG · auto-compressed · printed above signatory name"
            dataUrl={brandingData?.signatureImage ?? null}
            onPick={(f) => handleBrandingUpload("signatureImage", f)}
            onClear={() => handleBrandingClear("signatureImage")}
            previewClass="h-28"
            testId={`signature-${company.id}`}
            disabled={brandingUploading || updateCompany.isPending}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Image slot ───────────────────────────────────────────────────────────────

function ImageSlot({
  label,
  hint,
  dataUrl,
  onPick,
  onClear,
  previewClass,
  testId,
  disabled,
}: {
  label: string;
  hint: string;
  dataUrl: string | null;
  onPick: (f: File | null) => void;
  onClear: () => void;
  previewClass: string;
  testId: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        {dataUrl && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
            data-testid={`button-clear-${testId}`}
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
      <div
        className={`relative rounded-md border border-dashed border-border bg-muted/20 overflow-hidden flex items-center justify-center ${previewClass}`}
        data-testid={`preview-${testId}`}
      >
        {dataUrl ? (
          <img src={dataUrl} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
            <ImageIcon className="h-5 w-5 opacity-40" />
            <span>No image</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground flex-1 truncate">{hint}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          data-testid={`button-upload-${testId}`}
        >
          <Upload className="h-3 w-3 mr-1" /> {dataUrl ? "Replace" : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onPick(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
          data-testid={`input-file-${testId}`}
        />
      </div>
    </div>
  );
}

// ─── LOA option list for one category ────────────────────────────────────────

function OptionList({
  companyId,
  cfg,
}: {
  companyId: number;
  cfg: (typeof LOA_CATEGORIES)[number];
}) {
  const Icon = cfg.icon;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: options = [], isLoading } = useListLoaOptions({ companyId, category: cfg.category });
  const createMutation = useCreateLoaOption();
  const updateMutation = useUpdateLoaOption();
  const deleteMutation = useDeleteLoaOption();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListLoaOptionsQueryKey({ companyId, category: cfg.category }),
    });

  const handleAdd = () => {
    const v = value.trim();
    if (!v) return;
    createMutation.mutate(
      { data: { companyId, category: cfg.category, value: v } },
      {
        onSuccess: () => {
          setValue("");
          invalidate();
          toast({ title: `Added "${v}"` });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({
            title: status === 409 ? "Already exists" : "Failed to add",
            variant: "destructive",
          });
        },
      },
    );
  };

  const startEdit = (opt: LoaOption) => { setEditingId(opt.id); setEditValue(opt.value); };
  const cancelEdit = () => { setEditingId(null); setEditValue(""); };

  const saveEdit = (opt: LoaOption) => {
    const v = editValue.trim();
    if (!v || v === opt.value) { cancelEdit(); return; }
    updateMutation.mutate(
      { id: opt.id, data: { value: v } },
      {
        onSuccess: () => { invalidate(); cancelEdit(); toast({ title: `Renamed to "${v}"` }); },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({ title: status === 409 ? "Already exists" : "Failed to update", variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    const opt = options.find((o) => o.id === id);
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          setConfirmDeleteId(null);
          if (opt) toast({ title: `Removed "${opt.value}"` });
        },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      },
    );
  };

  const pendingDelete = confirmDeleteId != null ? options.find((o) => o.id === confirmDeleteId) : null;

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${cfg.accent} flex items-center justify-center shadow-sm flex-shrink-0`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{cfg.label}</h3>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                {options.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
          </div>
        </div>

        {/* Add input */}
        <div className="flex gap-2">
          <Input
            placeholder={cfg.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            data-testid={`input-add-${cfg.category}-${companyId}`}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!value.trim() || createMutation.isPending}
            data-testid={`button-add-${cfg.category}-${companyId}`}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}
          </div>
        ) : options.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            No {cfg.label.toLowerCase()} yet. Add one above.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {options.map((opt) => {
              const isEditing = editingId === opt.id;
              return (
                <li
                  key={opt.id}
                  className="group flex items-center gap-2 rounded-md border border-border/60 bg-card pl-3 pr-1.5 py-1.5 hover:border-primary/40 transition-colors"
                  data-testid={`row-option-${cfg.category}-${opt.id}`}
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(opt); }
                          else if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="h-7 text-sm"
                        data-testid={`input-edit-option-${opt.id}`}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={() => saveEdit(opt)} disabled={!editValue.trim()} data-testid={`button-save-option-${opt.id}`}>
                        {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEdit} data-testid={`button-cancel-edit-option-${opt.id}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="truncate flex-1 text-sm py-0.5">{opt.value}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity" onClick={() => startEdit(opt)} title="Rename" data-testid={`button-edit-option-${opt.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity" onClick={() => setConfirmDeleteId(opt.id)} disabled={deleteMutation.isPending} title="Remove" data-testid={`button-delete-option-${opt.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={confirmDeleteId != null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{pendingDelete?.value}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the option from {cfg.label}. Existing LOAs that referenced it are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId != null && handleDelete(confirmDeleteId)}
              data-testid={`button-confirm-delete-option-${confirmDeleteId}`}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
