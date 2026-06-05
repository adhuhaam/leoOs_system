import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLoaOptions,
  useCreateLoaOption,
  useUpdateLoaOption,
  useDeleteLoaOption,
  useListCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useListExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  useGetSystemSettings,
  useUpdateSystemSettings,
  useChangePassword,
  useGetExtensionToken,
  useRegenerateExtensionToken,
  getListLoaOptionsQueryKey,
  getListCompaniesQueryKey,
  getListExpenseCategoriesQueryKey,
  getGetSystemSettingsQueryKey,
  getGetExtensionTokenQueryKey,
} from "@workspace/api-client-react";
import type { LoaOption, Company, ExpenseCategory } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Briefcase, MapPin, Hammer, Settings as SettingsIcon, Building2, Image as ImageIcon, Upload, X, Save, Loader2, Pencil, Check, ListChecks, Wallet, Cog, Palette, KeyRound, Eye, EyeOff, Copy, RefreshCw, Plug } from "lucide-react";

type Category = "work_type" | "work_site" | "job_title";

interface ListConfig {
  category: Category;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string; // tailwind gradient classes
  placeholder: string;
}

const LISTS: ListConfig[] = [
  {
    category: "job_title",
    title: "Job Titles",
    description: "Occupations / roles selectable in the LOA form.",
    icon: Briefcase,
    accent: "from-indigo-500 to-violet-500",
    placeholder: "e.g. Construction Worker",
  },
  {
    category: "work_type",
    title: "Work Types",
    description: "Type of work (manual, technical, supervisory, etc.)",
    icon: Hammer,
    accent: "from-amber-500 to-orange-500",
    placeholder: "e.g. Manual Labour",
  },
  {
    category: "work_site",
    title: "Work Sites",
    description: "Project locations or sites of employment.",
    icon: MapPin,
    accent: "from-emerald-500 to-teal-500",
    placeholder: "e.g. Guraidhoo, Maldives",
  },
];

export default function SettingsPage() {
  // Persist the active tab in the URL hash so deep-links / back button work.
  const initialTab = (() => {
    if (typeof window === "undefined") return "companies";
    const h = window.location.hash.replace("#", "");
    return ["system", "companies", "expenses", "loa"].includes(h) ? h : "system";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, "", `#${activeTab}`);
    }
  }, [activeTab]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero header — gradient surface */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-teal-500/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative px-6 md:px-8 py-6 md:py-8">
          <div className="flex items-center gap-2 mb-2">
            <SettingsIcon className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              System Configuration
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl">
            Configure your companies, expense categories, and the dropdown values used
            throughout LEO OS. Changes take effect immediately.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-background/80 backdrop-blur-sm rounded-lg">
          <TabsList className="w-full h-auto p-1 bg-muted/60 grid grid-cols-2 sm:grid-cols-4 gap-1">
            <TabsTrigger
              value="system"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2"
              data-testid="tab-system"
            >
              <Cog className="h-4 w-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
            <TabsTrigger
              value="companies"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2"
              data-testid="tab-companies"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Companies</span>
            </TabsTrigger>
            <TabsTrigger
              value="expenses"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2"
              data-testid="tab-expenses"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Expense Categories</span>
              <span className="sm:hidden">Expenses</span>
            </TabsTrigger>
            <TabsTrigger
              value="loa"
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 py-2"
              data-testid="tab-loa"
            >
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">LOA Options</span>
              <span className="sm:hidden">LOA</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="system" className="mt-0 focus-visible:outline-none">
          <SystemSection />
        </TabsContent>

        <TabsContent value="companies" className="mt-0 focus-visible:outline-none">
          <CompaniesDetailsSection />
        </TabsContent>

        <TabsContent value="expenses" className="mt-0 focus-visible:outline-none">
          <ExpenseCategoriesSection />
        </TabsContent>

        <TabsContent value="loa" className="mt-0 focus-visible:outline-none">
          <LoaOptionsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Expense Categories
// ============================================================================

// Tailwind-friendly preset palette for the colored category cards on the
// Expenses page. Stored as a slug so we render it the same way everywhere.
const CATEGORY_COLOR_OPTIONS: { slug: string; label: string; swatch: string }[] = [
  { slug: "slate",   label: "Slate",   swatch: "bg-slate-700" },
  { slug: "sky",     label: "Sky",     swatch: "bg-sky-500" },
  { slug: "amber",   label: "Amber",   swatch: "bg-amber-400" },
  { slug: "emerald", label: "Emerald", swatch: "bg-emerald-500" },
  { slug: "rose",    label: "Rose",    swatch: "bg-rose-500" },
  { slug: "violet",  label: "Violet",  swatch: "bg-violet-500" },
  { slug: "indigo",  label: "Indigo",  swatch: "bg-indigo-500" },
  { slug: "teal",    label: "Teal",    swatch: "bg-teal-500" },
];

function colorSwatch(slug: string | null | undefined): string {
  return CATEGORY_COLOR_OPTIONS.find((o) => o.slug === slug)?.swatch ?? "bg-muted";
}

function ExpenseCategoriesSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categories = [], isLoading } = useListExpenseCategories();
  const createMutation = useCreateExpenseCategory();
  const updateMutation = useUpdateExpenseCategory();
  const deleteMutation = useDeleteExpenseCategory();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("slate");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>("slate");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListExpenseCategoriesQueryKey() });

  const handleAdd = () => {
    const v = name.trim();
    if (!v) return;
    createMutation.mutate(
      { data: { name: v, color } },
      {
        onSuccess: () => {
          setName("");
          invalidate();
          toast({ title: "Category added", description: v });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({
            title: status === 409 ? "Already exists" : "Failed to add",
            description: status === 409 ? `"${v}" already exists.` : "Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const startEdit = (c: ExpenseCategory) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color ?? "slate");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = (c: ExpenseCategory) => {
    const v = editName.trim();
    if (!v) return;
    const patch: { name?: string; color?: string | null } = {};
    if (v !== c.name) patch.name = v;
    if (editColor !== (c.color ?? "slate")) patch.color = editColor;
    if (Object.keys(patch).length === 0) {
      cancelEdit();
      return;
    }
    updateMutation.mutate(
      { id: c.id, data: patch },
      {
        onSuccess: () => {
          invalidate();
          cancelEdit();
          toast({ title: "Category updated" });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({
            title: status === 409 ? "Name already exists" : "Failed to update",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          setConfirmDeleteId(null);
          toast({ title: "Category removed" });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({
            title: status === 409 ? "Category in use" : "Failed to remove",
            description:
              status === 409
                ? "Delete or reassign its expenses first."
                : undefined,
            variant: "destructive",
          });
        },
      }
    );
  };

  const pendingDelete =
    confirmDeleteId != null ? categories.find((c) => c.id === confirmDeleteId) : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Expense Categories
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Expense Categories</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Categories shown as colored cards on the Expenses page (e.g.{" "}
          <span className="font-medium">BIGAREY</span>,{" "}
          <span className="font-medium">SUNA</span>,{" "}
          <span className="font-medium">PRO EMPLOYMENT</span>).
        </p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-5">
          {/* Add row */}
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <div className="flex-1 min-w-[160px] space-y-1.5">
              <Label className="text-xs font-medium">Category name</Label>
              <Input
                placeholder="e.g. BIGAREY"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                data-testid="input-add-expense-category"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Color</Label>
              <ColorPicker value={color} onChange={setColor} testId="add" />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-add-expense-category"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Add
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              No categories yet. Add the first one above.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {categories.map((c) => {
                const isEditing = editingId === c.id;
                return (
                  <li
                    key={c.id}
                    className="group flex items-center gap-2 rounded-md border border-border/60 bg-card pl-3 pr-1.5 py-1.5"
                    data-testid={`row-expense-category-${c.id}`}
                  >
                    {isEditing ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit(c);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          autoFocus
                          className="h-8 text-sm flex-1"
                          data-testid={`input-edit-category-${c.id}`}
                        />
                        <ColorPicker value={editColor} onChange={setEditColor} testId={`edit-${c.id}`} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                          onClick={() => saveEdit(c)}
                          disabled={!editName.trim() || updateMutation.isPending}
                          title="Save"
                          data-testid={`button-save-category-${c.id}`}
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
                          title="Cancel"
                          data-testid={`button-cancel-edit-category-${c.id}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${colorSwatch(c.color)}`}
                          aria-hidden
                        />
                        <span className="truncate flex-1 text-sm font-medium">{c.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          onClick={() => startEdit(c)}
                          title="Edit"
                          data-testid={`button-edit-category-${c.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          onClick={() => setConfirmDeleteId(c.id)}
                          disabled={deleteMutation.isPending}
                          title="Remove"
                          data-testid={`button-delete-category-${c.id}`}
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
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmDeleteId != null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              You can only remove a category that has no expenses. Delete or reassign its
              expenses first if you want to retire this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId != null && handleDelete(confirmDeleteId)}
              data-testid={`button-confirm-delete-category-${confirmDeleteId}`}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (slug: string) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1" data-testid={`color-picker-${testId}`}>
      {CATEGORY_COLOR_OPTIONS.map((opt) => {
        const active = opt.slug === value;
        return (
          <button
            key={opt.slug}
            type="button"
            title={opt.label}
            onClick={() => onChange(opt.slug)}
            className={`h-6 w-6 rounded-full ${opt.swatch} transition ${
              active
                ? "ring-2 ring-offset-2 ring-foreground/70"
                : "opacity-70 hover:opacity-100"
            }`}
            data-testid={`color-${testId}-${opt.slug}`}
            aria-label={opt.label}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// Company Details (name, address, email, country, registration number)
// ============================================================================

function CompaniesDetailsSection() {
  // Includes branding blobs (letterhead/signature) so each card can render them
  // inline. The list is short (a handful of companies) so the extra payload is fine.
  const { data: companies = [], isLoading } = useListCompanies({ withBranding: true });
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-3.5 w-3.5 text-teal-600" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Companies</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Companies</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Each card holds everything for one company — details, default signatory, letterhead, and e-signature.
            All of it appears on every Letter of Appointment generated for that company.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-company">
          <Plus className="h-4 w-4 mr-1" /> Add company
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-96" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          No companies yet. Click <span className="font-medium">Add company</span> to create your first one.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((c) => <CompanyDetailsCard key={c.id} company={c} />)}
        </div>
      )}

      <AddCompanyDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

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

function CompanyDetailsCard({ company }: { company: Company }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  // Branding handlers (letterhead + e-signature) — kept inline so each company
  // card is the single place for everything about that company.
  const invalidateCompanies = () =>
    queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });

  const handleBrandingUpload = async (
    kind: "letterheadImage" | "signatureImage",
    file: File | null,
  ) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Unsupported format", description: "Please upload a PNG or JPG image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "Image too large",
        description: `Maximum size is ${(MAX_IMAGE_BYTES / 1024).toFixed(0)} KB. Yours is ${(file.size / 1024).toFixed(0)} KB.`,
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
            toast({ title: "Saved", description: `${kind === "letterheadImage" ? "Letterhead" : "Signature"} updated for ${company.name}.` });
          },
          onError: () => toast({ title: "Failed to save image", variant: "destructive" }),
        },
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
      },
    );
  };

  const [form, setForm] = useState<CompanyFormState>(() => companyToForm(company));
  // Snapshot of the upstream values the form was last synced from. Stays put
  // when the user is editing so background refetches don't clobber typed input.
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

  // Only re-sync from upstream when the user has no unsaved edits. Otherwise
  // refetches (focus, invalidations) would silently wipe what they're typing.
  useEffect(() => {
    if (isDirty) return;
    const next = companyToForm(company);
    setBaseline(next);
    setForm(next);
    // We intentionally depend on `company` only — `isDirty` is checked at run
    // time and is derived from the latest `form`/`baseline` values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });

  const handleSave = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({ title: "Name required", description: "Company name can't be empty.", variant: "destructive" });
      return;
    }
    const trimmedEmail = form.email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Invalid email", description: "Enter a valid email address or leave it blank.", variant: "destructive" });
      return;
    }

    // Build a patch of only the fields the user actually changed so we don't
    // overwrite values another tab/user may have updated in the meantime.
    const trimmed: CompanyFormState = {
      name: trimmedName,
      address: form.address.trim(),
      email: trimmedEmail,
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
          // Adopt the just-saved values as the new baseline so the form is no
          // longer "dirty" and future refetches can sync cleanly.
          setBaseline(trimmed);
          setForm(trimmed);
          invalidate();
          toast({ title: "Saved", description: `Updated ${trimmedName}.` });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  const handleReset = () => setForm(baseline);

  const handleDelete = () => {
    deleteCompany.mutate(
      { id: company.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Deleted", description: `Removed ${company.name}.` });
          setConfirmDeleteOpen(false);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  };

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden" data-testid={`card-company-${company.id}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border/60">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
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
                  This permanently removes the company and its branding (letterhead and signature).
                  Letters of Appointment already generated for this company keep their snapshot of the
                  details and are not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteCompany.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={deleteCompany.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid={`button-confirm-delete-company-${company.id}`}
                >
                  {deleteCompany.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid gap-3">
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

          <div className="pt-2 mt-1 border-t border-border/60">
            <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Default Signatory
            </p>
            <p className="text-[11px] text-muted-foreground mb-2">
              Used to pre-fill the &quot;Details of Signatory&quot; block when generating an LOA for this company.
            </p>
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
                Images here are saved immediately — no need to click Save changes.
              </p>
            </div>
            <ImageSlot
              label="Letterhead"
              hint="Header image at top of PDF (e.g. logo + address banner)"
              dataUrl={company.letterheadImage ?? null}
              onPick={(f) => handleBrandingUpload("letterheadImage", f)}
              onClear={() => handleBrandingClear("letterheadImage")}
              previewClass="h-20 bg-white"
              testId={`letterhead-${company.id}`}
              disabled={updateCompany.isPending}
            />
            <ImageSlot
              label="e-Signature"
              hint="Transparent PNG works best (will sit on the signature line)"
              dataUrl={company.signatureImage ?? null}
              onPick={(f) => handleBrandingUpload("signatureImage", f)}
              onClear={() => handleBrandingClear("signatureImage")}
              previewClass="h-16 bg-[linear-gradient(45deg,_#f3f4f6_25%,_transparent_25%),_linear-gradient(-45deg,_#f3f4f6_25%,_transparent_25%),_linear-gradient(45deg,_transparent_75%,_#f3f4f6_75%),_linear-gradient(-45deg,_transparent_75%,_#f3f4f6_75%)] bg-[length:12px_12px] bg-[position:0_0,_0_6px,_6px_-6px,_-6px_0px]"
              testId={`signature-${company.id}`}
              disabled={updateCompany.isPending}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
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
      </CardContent>
    </Card>
  );
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

function AddCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCompany = useCreateCompany();
  const empty: CompanyFormState = {
    name: "",
    address: "",
    email: "",
    phone: "",
    country: "",
    registrationNumber: "",
    signatoryName: "",
    signatoryDesignation: "",
  };
  const [form, setForm] = useState<CompanyFormState>(empty);

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
          address: form.address.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          country: form.country.trim(),
          registrationNumber: form.registrationNumber.trim(),
          signatoryName: form.signatoryName.trim(),
          signatoryDesignation: form.signatoryDesignation.trim(),
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
            You can edit the rest of the details — and upload a letterhead and signature — afterwards.
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
            {createCompany.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Add company
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const MAX_IMAGE_BYTES = 500 * 1024; // 500 KB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
            // Reset so re-selecting the same file fires onChange
            if (inputRef.current) inputRef.current.value = "";
          }}
          data-testid={`input-file-${testId}`}
        />
      </div>
    </div>
  );
}

function LoaOptionsSection() {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">LOA Dropdown Options</span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Job Titles, Work Types &amp; Work Sites</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Add, rename, or delete the values that appear as dropdowns when generating a Letter of Appointment.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {LISTS.map((cfg) => (
          <OptionList key={cfg.category} cfg={cfg} />
        ))}
      </div>
    </div>
  );
}

function OptionList({ cfg }: { cfg: ListConfig }) {
  const Icon = cfg.icon;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: options = [], isLoading } = useListLoaOptions({ category: cfg.category });
  const createMutation = useCreateLoaOption();
  const updateMutation = useUpdateLoaOption();
  const deleteMutation = useDeleteLoaOption();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListLoaOptionsQueryKey({ category: cfg.category }) });

  const handleAdd = () => {
    const v = value.trim();
    if (!v) return;
    createMutation.mutate(
      { data: { category: cfg.category, value: v } },
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
            description: status === 409 ? `"${v}" is already in this list.` : "Please try again.",
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
    if (!v) return;
    if (v === opt.value) {
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
            description: status === 409 ? `"${v}" is already in this list.` : "Please try again.",
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

  const pendingDelete = confirmDeleteId != null ? options.find((o) => o.id === confirmDeleteId) : null;

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden flex flex-col">
      <CardContent className="p-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${cfg.accent} flex items-center justify-center shadow-sm flex-shrink-0`}>
            <Icon className="h-5 w-5 text-white" />
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

        {/* Add input */}
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
            data-testid={`input-add-${cfg.category}`}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!value.trim() || createMutation.isPending}
            data-testid={`button-add-${cfg.category}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 min-h-[120px]">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : options.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              No items yet. Add the first one above.
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
                              e.preventDefault();
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
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                          onClick={() => saveEdit(opt)}
                          disabled={!editValue.trim() || updateMutation.isPending}
                          title="Save"
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
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={cancelEdit}
                          title="Cancel"
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
            <AlertDialogTitle>Remove this {cfg.title.toLowerCase().replace(/s$/, "")}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>"{pendingDelete?.value}"</strong> from {cfg.title}. Letters of
              Appointment already generated with this value are unaffected — they keep their snapshot.
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
    </Card>
  );
}

// ============================================================================
// System (app name, branding, theme, password)
// ============================================================================

const HUE_PRESETS: { name: string; hue: number }[] = [
  { name: "Teal",    hue: 162 },
  { name: "Emerald", hue: 152 },
  { name: "Sky",     hue: 200 },
  { name: "Indigo",  hue: 235 },
  { name: "Violet",  hue: 265 },
  { name: "Rose",    hue: 340 },
  { name: "Amber",   hue: 35 },
  { name: "Slate",   hue: 215 },
];

interface SystemFormState {
  appName: string;
  accentHue: number;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyRegistrationNumber: string;
  logoImage: string | null;
}

function SystemSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useGetSystemSettings();
  const updateMutation = useUpdateSystemSettings();

  const [form, setForm] = useState<SystemFormState | null>(null);

  // Hydrate the local form whenever the server payload changes (and we don't
  // have unsaved edits yet).
  useEffect(() => {
    if (!data) return;
    setForm((prev) =>
      prev ?? {
        appName: data.appName,
        accentHue: data.accentHue,
        companyName: data.companyName ?? "",
        companyAddress: data.companyAddress ?? "",
        companyPhone: data.companyPhone ?? "",
        companyEmail: data.companyEmail ?? "",
        companyWebsite: data.companyWebsite ?? "",
        companyRegistrationNumber: data.companyRegistrationNumber ?? "",
        logoImage: data.logoImage ?? null,
      }
    );
  }, [data]);

  if (isLoading || !form || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const dirty =
    form.appName !== data.appName ||
    form.accentHue !== data.accentHue ||
    (form.companyName || "") !== (data.companyName ?? "") ||
    (form.companyAddress || "") !== (data.companyAddress ?? "") ||
    (form.companyPhone || "") !== (data.companyPhone ?? "") ||
    (form.companyEmail || "") !== (data.companyEmail ?? "") ||
    (form.companyWebsite || "") !== (data.companyWebsite ?? "") ||
    (form.companyRegistrationNumber || "") !== (data.companyRegistrationNumber ?? "") ||
    (form.logoImage ?? null) !== (data.logoImage ?? null);

  const handleSave = () => {
    const trimmedName = form.appName.trim();
    if (!trimmedName) {
      toast({ title: "App name is required", variant: "destructive" });
      return;
    }
    updateMutation.mutate(
      {
        data: {
          appName: trimmedName,
          accentHue: form.accentHue,
          companyName: form.companyName.trim() || null,
          companyAddress: form.companyAddress.trim() || null,
          companyPhone: form.companyPhone.trim() || null,
          companyEmail: form.companyEmail.trim() || null,
          companyWebsite: form.companyWebsite.trim() || null,
          companyRegistrationNumber: form.companyRegistrationNumber.trim() || null,
          logoImage: form.logoImage,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSystemSettingsQueryKey() });
          toast({ title: "System settings saved" });
        },
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            "Please try again.";
          toast({ title: "Failed to save", description: message, variant: "destructive" });
        },
      }
    );
  };

  const handleReset = () => {
    setForm({
      appName: data.appName,
      accentHue: data.accentHue,
      companyName: data.companyName ?? "",
      companyAddress: data.companyAddress ?? "",
      companyPhone: data.companyPhone ?? "",
      companyEmail: data.companyEmail ?? "",
      companyWebsite: data.companyWebsite ?? "",
      companyRegistrationNumber: data.companyRegistrationNumber ?? "",
      logoImage: data.logoImage ?? null,
    });
  };

  const pickLogo = async (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      toast({ title: "Unsupported image type", description: "Use PNG, JPEG, WebP or SVG.", variant: "destructive" });
      return;
    }
    if (file.size > 600 * 1024) {
      toast({ title: "Image too large", description: "Max 600 KB.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((s) => (s ? { ...s, logoImage: dataUrl } : s));
    } catch {
      toast({ title: "Failed to read image", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Cog className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Identity
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight -mt-3">App identity</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            The name and logo that appear in the sidebar, browser tab, and login screen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-5 items-start">
            <div>
              <ImageSlot
                label="Logo"
                hint="PNG / JPEG / WebP, ≤600 KB"
                dataUrl={form.logoImage}
                onPick={pickLogo}
                onClear={() => setForm((s) => (s ? { ...s, logoImage: null } : s))}
                previewClass="h-32 bg-muted/40"
                testId="system-logo"
              />
            </div>

            <div className="space-y-4">
              <Field
                label="App name"
                value={form.appName}
                onChange={(v) => setForm((s) => (s ? { ...s, appName: v } : s))}
                placeholder="LEO OS"
                required
                testId="system-app-name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company / organization */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Organization
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight -mt-3">Default company details</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Used as the default issuer on documents and shown in the app header.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Company name"
              value={form.companyName}
              onChange={(v) => setForm((s) => (s ? { ...s, companyName: v } : s))}
              placeholder="LEO Employment Services Pvt Ltd"
              testId="system-company-name"
            />
            <Field
              label="Registration number"
              value={form.companyRegistrationNumber}
              onChange={(v) => setForm((s) => (s ? { ...s, companyRegistrationNumber: v } : s))}
              placeholder="C20542025"
              testId="system-company-reg"
            />
            <Field
              label="Phone"
              value={form.companyPhone}
              onChange={(v) => setForm((s) => (s ? { ...s, companyPhone: v } : s))}
              placeholder="+960 ..."
              testId="system-company-phone"
            />
            <Field
              label="Email"
              type="email"
              value={form.companyEmail}
              onChange={(v) => setForm((s) => (s ? { ...s, companyEmail: v } : s))}
              placeholder="hello@example.com"
              testId="system-company-email"
            />
            <Field
              label="Website"
              value={form.companyWebsite}
              onChange={(v) => setForm((s) => (s ? { ...s, companyWebsite: v } : s))}
              placeholder="https://example.com"
              testId="system-company-website"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Address</Label>
            <Textarea
              value={form.companyAddress}
              onChange={(e) =>
                setForm((s) => (s ? { ...s, companyAddress: e.target.value } : s))
              }
              placeholder="Street, City, Country"
              rows={3}
              data-testid="input-system-company-address"
            />
          </div>
        </CardContent>
      </Card>

      {/* Color scheme */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Appearance
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight -mt-3">Accent color</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Pick a preset or fine-tune the hue. Changes preview live and apply to everyone after
            saving.
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {HUE_PRESETS.map((p) => {
              const active = form.accentHue === p.hue;
              return (
                <button
                  key={p.hue}
                  type="button"
                  onClick={() => setForm((s) => (s ? { ...s, accentHue: p.hue } : s))}
                  className={`group flex flex-col items-center gap-1.5 rounded-md p-2 border transition ${
                    active ? "border-foreground/40 bg-muted/60" : "border-transparent hover:bg-muted/40"
                  }`}
                  data-testid={`hue-preset-${p.name.toLowerCase()}`}
                >
                  <div
                    className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background"
                    style={{
                      background: `hsl(${p.hue} 42% 50%)`,
                      // @ts-expect-error CSS var
                      "--tw-ring-color": active ? `hsl(${p.hue} 42% 50%)` : "transparent",
                    }}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">{p.name}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Custom hue</Label>
              <span className="text-[10px] font-mono text-muted-foreground">
                {form.accentHue}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={form.accentHue}
              onChange={(e) =>
                setForm((s) => (s ? { ...s, accentHue: Number(e.target.value) } : s))
              }
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background:
                  "linear-gradient(to right, hsl(0 70% 50%), hsl(60 70% 50%), hsl(120 70% 50%), hsl(180 70% 50%), hsl(240 70% 50%), hsl(300 70% 50%), hsl(360 70% 50%))",
              }}
              data-testid="input-system-hue"
            />
          </div>

          {/* Live preview swatches */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="rounded-md p-3 text-xs text-white shadow-sm" style={{ background: `hsl(${form.accentHue} 38% 38%)` }}>
              Primary
            </div>
            <div
              className="rounded-md p-3 text-xs shadow-sm"
              style={{
                background: `hsl(${form.accentHue} 45% 92%)`,
                color: `hsl(${form.accentHue} 50% 24%)`,
              }}
            >
              Accent
            </div>
            <div
              className="rounded-md p-3 text-xs text-white shadow-sm"
              style={{ background: `hsl(${form.accentHue} 42% 58%)` }}
            >
              Sidebar
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-2 z-10 flex items-center justify-end gap-2 rounded-lg border border-border/60 bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
        <span className="mr-auto text-[11px] text-muted-foreground">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={!dirty || updateMutation.isPending}
          data-testid="button-system-reset"
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
          data-testid="button-system-save"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1" />
          )}
          Save settings
        </Button>
      </div>

      {/* Password */}
      <PasswordCard hasCustomPassword={data.hasCustomPassword} />

      {/* Extension access */}
      <ExtensionAccessCard />
    </div>
  );
}

function ExtensionAccessCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useGetExtensionToken();
  const regenerateMutation = useRegenerateExtensionToken();

  const [showToken, setShowToken] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const token = data?.token ?? null;
  const baseUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api` : "/api";

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExtensionTokenQueryKey() });
        setConfirmOpen(false);
        setShowToken(false);
        toast({ title: "Token regenerated", description: "The old token no longer works." });
      },
      onError: () => {
        toast({ title: "Failed to regenerate token", variant: "destructive" });
      },
    });
  };

  const maskedToken = token ? `${token.slice(0, 8)}${"•".repeat(24)}${token.slice(-8)}` : "";

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Plug className="h-3.5 w-3.5 text-sky-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Developer
          </span>
        </div>
        <div className="-mt-3">
          <h2 className="text-xl font-semibold tracking-tight">Extension access</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Use these values to configure your Chrome extension. The token authenticates API
            calls without a browser session — treat it like a password.
          </p>
        </div>

        {/* API Base URL */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">API base URL</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={baseUrl}
              className="font-mono text-sm bg-muted/40"
              data-testid="input-ext-base-url"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyText(baseUrl, "API base URL")}
              title="Copy URL"
              data-testid="button-copy-base-url"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Set this as the base URL in your extension config.
          </p>
        </div>

        {/* Token */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">API token</Label>
          {isLoading ? (
            <div className="h-10 rounded-md border border-border bg-muted/40 animate-pulse" />
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={showToken ? (token ?? "") : maskedToken}
                  className="font-mono text-sm bg-muted/40 pr-10"
                  data-testid="input-ext-token"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  data-testid="button-toggle-token-visibility"
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => token && copyText(token, "Token")}
                disabled={!token}
                title="Copy token"
                data-testid="button-copy-token"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Send this as{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
              Authorization: Bearer &lt;token&gt;
            </code>{" "}
            on every extension request.
          </p>
        </div>

        {/* Regenerate */}
        <div className="flex justify-end pt-1">
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-regenerate-token"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Regenerate token
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate extension token?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current token will stop working immediately. You will need to update your
                  Chrome extension with the new token before it can make API calls again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={regenerateMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleRegenerate();
                  }}
                  disabled={regenerateMutation.isPending}
                  data-testid="button-confirm-regenerate-token"
                >
                  {regenerateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Regenerate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordCard({ hasCustomPassword }: { hasCustomPassword: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const changeMutation = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const submit = () => {
    if (next.length < 6) {
      toast({ title: "New password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (next !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    changeMutation.mutate(
      { data: { currentPassword: current, newPassword: next } },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
          queryClient.invalidateQueries({ queryKey: getGetSystemSettingsQueryKey() });
          toast({ title: "Password updated" });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          toast({
            title: status === 401 ? "Current password is incorrect" : "Failed to update password",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Security
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight -mt-3">Change password</h2>
        <p className="text-xs text-muted-foreground -mt-2">
          {hasCustomPassword
            ? "A custom password is currently in use."
            : "You're still using the initial environment password. Set a new one to take ownership."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Current password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                data-testid="input-current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New password</Label>
            <div className="relative">
              <Input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNext((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNext ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm new password</Label>
            <Input
              type={showNext ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              data-testid="input-confirm-password"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={submit}
            disabled={!current || !next || !confirm || changeMutation.isPending}
            data-testid="button-change-password"
          >
            {changeMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5 mr-1" />
            )}
            Update password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
