import { useEffect, useRef, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Building2,
  Briefcase,
  MapPin,
  Hammer,
  Pencil,
  Check,
  X,
  Image as ImageIcon,
  Upload,
  ListChecks,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 500 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const LOA_CATEGORIES = [
  {
    category: "job_title" as const,
    title: "Job Titles",
    description: "Occupations / roles selectable in the LOA form.",
    icon: Briefcase,
    accent: "from-indigo-500 to-violet-500",
    placeholder: "e.g. Construction Worker",
  },
  {
    category: "work_type" as const,
    title: "Work Types",
    description: "Type of work (manual, technical, supervisory, etc.)",
    icon: Hammer,
    accent: "from-amber-500 to-orange-500",
    placeholder: "e.g. Manual Labour",
  },
  {
    category: "work_site" as const,
    title: "Work Sites",
    description: "Project locations or sites of employment.",
    icon: MapPin,
    accent: "from-emerald-500 to-teal-500",
    placeholder: "e.g. Guraidhoo, Maldives",
  },
] as const;

type LoaCategory = "job_title" | "work_type" | "work_site";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={`input-${testId}`}
      />
    </div>
  );
}

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
        className={`relative rounded-md border border-dashed border-border overflow-hidden flex items-center justify-center ${previewClass}`}
        data-testid={`preview-${testId}`}
      >
        {dataUrl ? (
          <img src={dataUrl} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" /> No image
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

// ─── LOA Option list for one category + company ───────────────────────────────

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

  const { data: options = [], isLoading } = useListLoaOptions({
    companyId,
    category: cfg.category,
  });
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
          toast({ title: "Added", description: `Added "${v}" to ${cfg.title}.` });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({
            title: status === 409 ? "Already exists" : "Failed to add",
            description:
              status === 409 ? `"${v}" is already in this list.` : "Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const startEdit = (opt: LoaOption) => {
    setEditingId(opt.id);
    setEditValue(opt.value);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = (opt: LoaOption) => {
    const v = editValue.trim();
    if (!v || v === opt.value) {
      cancelEdit();
      return;
    }
    updateMutation.mutate(
      { id: opt.id, data: { value: v } },
      {
        onSuccess: () => {
          invalidate();
          cancelEdit();
          toast({ title: "Updated", description: `Renamed to "${v}".` });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({
            title: status === 409 ? "Already exists" : "Failed to update",
            variant: "destructive",
          });
        },
      }
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
          if (opt) toast({ title: "Removed", description: `Removed "${opt.value}".` });
        },
        onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
      }
    );
  };

  const pendingDelete =
    confirmDeleteId != null ? options.find((o) => o.id === confirmDeleteId) : null;

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden flex flex-col">
      <CardContent className="p-5 flex-1 flex flex-col">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`h-9 w-9 rounded-lg bg-gradient-to-br ${cfg.accent} flex items-center justify-center shadow-sm flex-shrink-0`}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-tight">{cfg.title}</h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {options.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <Input
            placeholder={cfg.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            data-testid={`input-add-${cfg.category}-${companyId}`}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!value.trim() || createMutation.isPending}
            data-testid={`button-add-${cfg.category}-${companyId}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-[80px]">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              No items yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {options.map((opt) => {
                const isEditing = editingId === opt.id;
                return (
                  <li
                    key={opt.id}
                    className="group flex items-center gap-2 rounded-md border border-border/60 bg-card pl-3 pr-1.5 py-1 text-sm hover:border-primary/40 transition-colors"
                    data-testid={`row-option-${cfg.category}-${opt.id}`}
                  >
                    {isEditing ? (
                      <>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit(opt);
                            } else if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                          autoFocus
                          className="h-7 text-sm"
                          data-testid={`input-edit-option-${opt.id}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                          onClick={() => saveEdit(opt)}
                          disabled={!editValue.trim() || updateMutation.isPending}
                          data-testid={`button-save-option-${opt.id}`}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={cancelEdit}
                          data-testid={`button-cancel-edit-option-${opt.id}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="truncate flex-1 py-1">{opt.value}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          onClick={() => startEdit(opt)}
                          title="Rename"
                          data-testid={`button-edit-option-${opt.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          onClick={() => setConfirmDeleteId(opt.id)}
                          disabled={deleteMutation.isPending}
                          title="Remove"
                          data-testid={`button-delete-option-${opt.id}`}
                        >
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
      </CardContent>

      <AlertDialog
        open={confirmDeleteId != null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove this {cfg.title.toLowerCase().replace(/s$/, "")}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>"{pendingDelete?.value}"</strong> from {cfg.title}. Existing
              LOAs that used this value are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId != null && handleDelete(confirmDeleteId)}
              data-testid={`button-confirm-delete-option-${confirmDeleteId}`}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Company details form card ────────────────────────────────────────────────

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

function CompanyCard({ company }: { company: Company }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  const invalidateCompanies = () =>
    queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });

  const handleBrandingUpload = async (
    kind: "letterheadImage" | "signatureImage",
    file: File | null
  ) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported format",
        description: "Please upload a PNG or JPG image.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "Image too large",
        description: `Maximum ${(MAX_IMAGE_BYTES / 1024).toFixed(0)} KB.`,
        variant: "destructive",
      });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateCompany.mutate(
        { id: company.id, data: { [kind]: dataUrl } },
        {
          onSuccess: () => {
            invalidateCompanies();
            toast({
              title: "Saved",
              description: `${kind === "letterheadImage" ? "Letterhead" : "Signature"} updated.`,
            });
          },
          onError: () => toast({ title: "Failed to save image", variant: "destructive" }),
        }
      );
    } catch {
      toast({ title: "Failed to read file", variant: "destructive" });
    }
  };

  const handleBrandingClear = (kind: "letterheadImage" | "signatureImage") => {
    updateCompany.mutate(
      { id: company.id, data: { [kind]: null } },
      {
        onSuccess: () => {
          invalidateCompanies();
          toast({ title: "Removed" });
        },
        onError: () => toast({ title: "Failed to remove image", variant: "destructive" }),
      }
    );
  };

  const [form, setForm] = useState<CompanyFormState>(() => companyToForm(company));
  const [baseline, setBaseline] = useState<CompanyFormState>(() => companyToForm(company));
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isDirty =
    form.name !== baseline.name ||
    form.address !== baseline.address ||
    form.email !== baseline.email ||
    form.phone !== baseline.phone ||
    form.country !== baseline.country ||
    form.registrationNumber !== baseline.registrationNumber ||
    form.signatoryName !== baseline.signatoryName ||
    form.signatoryDesignation !== baseline.signatoryDesignation;

  useEffect(() => {
    if (isDirty) return;
    const next = companyToForm(company);
    setBaseline(next);
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const handleSave = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const trimmed: CompanyFormState = {
      name: trimmedName,
      address: form.address.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country.trim(),
      registrationNumber: form.registrationNumber.trim(),
      signatoryName: form.signatoryName.trim(),
      signatoryDesignation: form.signatoryDesignation.trim(),
    };
    const patch: Partial<CompanyFormState> = {};
    (Object.keys(trimmed) as (keyof CompanyFormState)[]).forEach((k) => {
      if (trimmed[k] !== baseline[k]) patch[k] = trimmed[k];
    });
    if (Object.keys(patch).length === 0) {
      toast({ title: "Nothing to save" });
      return;
    }
    updateCompany.mutate(
      { id: company.id, data: patch },
      {
        onSuccess: () => {
          setBaseline(trimmed);
          setForm(trimmed);
          invalidateCompanies();
          toast({ title: "Saved", description: `Updated ${trimmedName}.` });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  return (
    <Card
      className="border-border/60 shadow-sm overflow-hidden"
      data-testid={`card-company-${company.id}`}
    >
      <CardContent className="p-0">
        {/* Company header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate">{company.name}</h3>
            <p className="text-[10px] font-mono text-muted-foreground">ID #{company.id}</p>
          </div>
          <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Delete company"
                data-testid={`button-delete-company-${company.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {company.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the company, its branding, and all its LOA options
                  (job titles, work types, work sites). Existing LOA documents keep their
                  snapshot and are not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteCompany.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    deleteCompany.mutate(
                      { id: company.id },
                      {
                        onSuccess: () => {
                          invalidateCompanies();
                          toast({ title: "Deleted", description: `Removed ${company.name}.` });
                          setConfirmDeleteOpen(false);
                        },
                        onError: () =>
                          toast({ title: "Failed to delete", variant: "destructive" }),
                      }
                    );
                  }}
                  disabled={deleteCompany.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid={`button-confirm-delete-company-${company.id}`}
                >
                  {deleteCompany.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Tabs: Details | LOA Options */}
        <Tabs defaultValue="details">
          <TabsList className="w-full rounded-none border-b border-border/60 h-10 bg-muted/40 px-4 gap-1 justify-start">
            <TabsTrigger value="details" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Details
            </TabsTrigger>
            <TabsTrigger value="loa" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
              <ListChecks className="h-3 w-3" />
              LOA Options
            </TabsTrigger>
          </TabsList>

          {/* ── Details tab ── */}
          <TabsContent value="details" className="p-5 space-y-3 mt-0">
            <Field
              label="Company name"
              required
              value={form.name}
              onChange={(v) => setForm((s) => ({ ...s, name: v }))}
              placeholder="LEO Employment Services"
              testId={`name-${company.id}`}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm((s) => ({ ...s, email: v }))}
                placeholder="contact@example.com"
                testId={`email-${company.id}`}
              />
              <Field
                label="Phone"
                value={form.phone}
                onChange={(v) => setForm((s) => ({ ...s, phone: v }))}
                placeholder="+960 999 0000"
                testId={`phone-${company.id}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Country"
                value={form.country}
                onChange={(v) => setForm((s) => ({ ...s, country: v }))}
                placeholder="Maldives"
                testId={`country-${company.id}`}
              />
              <Field
                label="Registration #"
                value={form.registrationNumber}
                onChange={(v) => setForm((s) => ({ ...s, registrationNumber: v }))}
                placeholder="C-20542025"
                testId={`reg-${company.id}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Address</Label>
              <Textarea
                rows={2}
                value={form.address}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                placeholder="Street, city, postcode"
                data-testid={`input-address-${company.id}`}
              />
            </div>

            <div className="pt-2 mt-1 border-t border-border/60 space-y-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                  Default Signatory
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Pre-fills the signatory block when generating an LOA for this company.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Signatory name"
                  value={form.signatoryName}
                  onChange={(v) => setForm((s) => ({ ...s, signatoryName: v }))}
                  placeholder="Abdulla Muneeb"
                  testId={`signatory-name-${company.id}`}
                />
                <Field
                  label="Designation"
                  value={form.signatoryDesignation}
                  onChange={(v) => setForm((s) => ({ ...s, signatoryDesignation: v }))}
                  placeholder="Managing Director"
                  testId={`signatory-designation-${company.id}`}
                />
              </div>
            </div>

            <div className="pt-3 mt-1 border-t border-border/60 space-y-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Letterheads &amp; e-Signatures
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Images are saved immediately.
                </p>
              </div>
              <ImageSlot
                label="Letterhead"
                hint="Header image at the top of generated LOA PDFs"
                dataUrl={company.letterheadImage ?? null}
                onPick={(f) => handleBrandingUpload("letterheadImage", f)}
                onClear={() => handleBrandingClear("letterheadImage")}
                previewClass="h-20 bg-white"
                testId={`letterhead-${company.id}`}
                disabled={updateCompany.isPending}
              />
              <ImageSlot
                label="e-Signature"
                hint="Transparent PNG works best — placed on the signature line"
                dataUrl={company.signatureImage ?? null}
                onPick={(f) => handleBrandingUpload("signatureImage", f)}
                onClear={() => handleBrandingClear("signatureImage")}
                previewClass="h-16 bg-[linear-gradient(45deg,_#f3f4f6_25%,_transparent_25%),_linear-gradient(-45deg,_#f3f4f6_25%,_transparent_25%),_linear-gradient(45deg,_transparent_75%,_#f3f4f6_75%),_linear-gradient(-45deg,_transparent_75%,_#f3f4f6_75%)] bg-[length:12px_12px] bg-[position:0_0,_0_6px,_6px_-6px,_-6px_0px]"
                testId={`signature-${company.id}`}
                disabled={updateCompany.isPending}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              {isDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm(baseline)}
                  disabled={updateCompany.isPending}
                  data-testid={`button-reset-${company.id}`}
                >
                  Reset
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || updateCompany.isPending}
                data-testid={`button-save-company-${company.id}`}
              >
                {updateCompany.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save changes
              </Button>
            </div>
          </TabsContent>

          {/* ── LOA Options tab ── */}
          <TabsContent value="loa" className="p-5 mt-0">
            <div className="grid gap-4 lg:grid-cols-3">
              {LOA_CATEGORIES.map((cfg) => (
                <OptionList key={cfg.category} companyId={company.id} cfg={cfg} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Add Company Dialog ────────────────────────────────────────────────────────

function AddCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createCompany = useCreateCompany();

  const empty = {
    name: "",
    address: "",
    email: "",
    phone: "",
    country: "",
    registrationNumber: "",
    signatoryName: "",
    signatoryDesignation: "",
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) setForm(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCreate = () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    createCompany.mutate(
      {
        data: {
          name,
          address: form.address.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          country: form.country.trim() || undefined,
          registrationNumber: form.registrationNumber.trim() || undefined,
          signatoryName: form.signatoryName.trim() || undefined,
          signatoryDesignation: form.signatoryDesignation.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
          toast({ title: "Company added", description: name });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to add company", variant: "destructive" }),
      }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Add a company</AlertDialogTitle>
          <AlertDialogDescription>
            You can add branding images and LOA options after saving.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 py-2">
          <Field
            label="Company name"
            required
            value={form.name}
            onChange={(v) => setForm((s) => ({ ...s, name: v }))}
            placeholder="LEO Employment Services"
            testId="new-name"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((s) => ({ ...s, email: v }))}
              placeholder="contact@example.com"
              testId="new-email"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm((s) => ({ ...s, phone: v }))}
              placeholder="+960 999 0000"
              testId="new-phone"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Country"
              value={form.country}
              onChange={(v) => setForm((s) => ({ ...s, country: v }))}
              testId="new-country"
            />
            <Field
              label="Registration #"
              value={form.registrationNumber}
              onChange={(v) => setForm((s) => ({ ...s, registrationNumber: v }))}
              testId="new-reg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Address</Label>
            <Textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              data-testid="input-new-address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
            <Field
              label="Signatory name"
              value={form.signatoryName}
              onChange={(v) => setForm((s) => ({ ...s, signatoryName: v }))}
              placeholder="Abdulla Muneeb"
              testId="new-signatory-name"
            />
            <Field
              label="Designation"
              value={form.signatoryDesignation}
              onChange={(v) => setForm((s) => ({ ...s, signatoryDesignation: v }))}
              placeholder="Managing Director"
              testId="new-signatory-designation"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={createCompany.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            disabled={createCompany.isPending || !form.name.trim()}
            data-testid="button-confirm-add-company"
          >
            {createCompany.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Add company
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: companies = [], isLoading } = useListCompanies({ withBranding: true });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-indigo-500/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="relative px-6 md:px-8 py-6 md:py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-3.5 w-3.5 text-teal-600" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Company Management
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Companies</h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
                Manage company details, letterheads, e-signatures, and per-company dropdown options
                (job titles, work types, work sites) used when generating Letters of Appointment.
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-company">
              <Plus className="h-4 w-4 mr-1" /> Add company
            </Button>
          </div>
        </div>
      </div>

      {/* Company cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          No companies yet. Click{" "}
          <span className="font-medium">Add company</span> to create the first one.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {companies.map((c) => (
            <CompanyCard key={c.id} company={c} />
          ))}
        </div>
      )}

      <AddCompanyDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
