import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSalaryRecords,
  useCreateSalaryRecord,
  useUpdateSalaryRecord,
  useDeleteSalaryRecord,
  useListPassports,
  getListSalaryRecordsQueryKey,
  type SalaryRecord,
  type Passport,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Users,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  ChevronDown,
  TrendingUp,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function fmtMVR(val: string | number | null | undefined): string {
  const n = Number(val ?? "0");
  if (isNaN(n)) return "MVR —";
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type SalaryFormData = {
  basicSalary: string;
  foodAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  deductions: string;
  otherExpenses: string;
  notes: string;
  status: "draft" | "confirmed";
};

const EMPTY_FORM: SalaryFormData = {
  basicSalary: "",
  foodAllowance: "0",
  transportAllowance: "0",
  otherAllowances: "0",
  deductions: "0",
  otherExpenses: "0",
  notes: "",
  status: "draft",
};

function computeNet(f: SalaryFormData): number {
  const n = (v: string) => parseFloat(v) || 0;
  return (
    n(f.basicSalary) +
    n(f.foodAllowance) +
    n(f.transportAllowance) +
    n(f.otherAllowances) +
    n(f.otherExpenses) -
    n(f.deductions)
  );
}

function SalaryFormDialog({
  open,
  onOpenChange,
  passport,
  existing,
  month,
  year,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  passport: Passport;
  existing: SalaryRecord | null;
  month: number;
  year: number;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createMutation = useCreateSalaryRecord();
  const updateMutation = useUpdateSalaryRecord();

  const [form, setForm] = useState<SalaryFormData>(() =>
    existing
      ? {
          basicSalary: existing.basicSalary,
          foodAllowance: existing.foodAllowance,
          transportAllowance: existing.transportAllowance,
          otherAllowances: existing.otherAllowances,
          deductions: existing.deductions,
          otherExpenses: existing.otherExpenses,
          notes: existing.notes ?? "",
          status: existing.status as "draft" | "confirmed",
        }
      : EMPTY_FORM,
  );

  // Reset form when dialog opens with new data
  const resetKey = `${open}-${existing?.id ?? "new"}-${passport.id}`;

  const net = computeNet(form);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const field = (key: keyof SalaryFormData, label: string, placeholder = "0.00") => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder={placeholder}
        value={(form as Record<string, string>)[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className="h-9"
      />
    </div>
  );

  async function handleSave() {
    if (!form.basicSalary || parseFloat(form.basicSalary) <= 0) {
      toast({ title: "Basic salary required", description: "Enter a basic salary amount.", variant: "destructive" });
      return;
    }
    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, data: { ...form, notes: form.notes || null } });
      } else {
        await createMutation.mutateAsync({
          data: {
            passportId: passport.id,
            month,
            year,
            ...form,
            notes: form.notes || null,
          },
        });
      }
      onSaved();
      onOpenChange(false);
      toast({ title: existing ? "Salary updated" : "Salary generated", description: `${passport.fullName ?? "Employee"} — ${MONTHS[month - 1]} ${year}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit Salary" : "Generate Salary"} — {MONTHS[month - 1]} {year}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{passport.fullName ?? "—"} · {passport.passportNumber ?? "—"}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Earnings */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Earnings</h4>
            <div className="grid grid-cols-2 gap-3">
              {field("basicSalary", "Basic Salary *", "0.00")}
              {field("foodAllowance", "Food Allowance")}
              {field("transportAllowance", "Transport Allowance")}
              {field("otherAllowances", "Other Allowances")}
              {field("otherExpenses", "Other Expenses")}
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider">Deductions</h4>
            {field("deductions", "Total Deductions")}
          </div>

          {/* Net Salary Preview */}
          <div className="rounded-xl bg-muted/60 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Net Salary</span>
            <span className={`text-lg font-bold ${net < 0 ? "text-destructive" : "text-foreground"}`}>
              {fmtMVR(net)}
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notes</Label>
            <Textarea
              placeholder="Optional notes…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
            <Select value={form.status} onValueChange={(v: "draft" | "confirmed") => setForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending} className="min-w-24">
            {isPending ? "Saving…" : existing ? "Update" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
        <CheckCircle className="h-3 w-3" /> Confirmed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
      <Clock className="h-3 w-3" /> Draft
    </Badge>
  );
}

export default function SalaryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");

  const [dialogPassport, setDialogPassport] = useState<Passport | null>(null);
  const [dialogExisting, setDialogExisting] = useState<SalaryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalaryRecord | null>(null);

  const { data: allPassports, isLoading: passportsLoading } = useListPassports();
  const { data: salaryRecords, isLoading: salaryLoading } = useListSalaryRecords({ month, year });
  const deleteMutation = useDeleteSalaryRecord();

  const isLoading = passportsLoading || salaryLoading;

  // Map passportId → salary record for this month/year
  const salaryMap = useMemo(() => {
    const m = new Map<number, SalaryRecord>();
    for (const r of salaryRecords ?? []) m.set(r.passportId, r);
    return m;
  }, [salaryRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allPassports ?? []).filter(
      (p) =>
        !q ||
        (p.fullName ?? "").toLowerCase().includes(q) ||
        (p.passportNumber ?? "").toLowerCase().includes(q),
    );
  }, [allPassports, search]);

  const totalNet = useMemo(
    () => (salaryRecords ?? []).reduce((s, r) => s + parseFloat(r.netSalary || "0"), 0),
    [salaryRecords],
  );

  const confirmedCount = useMemo(
    () => (salaryRecords ?? []).filter((r) => r.status === "confirmed").length,
    [salaryRecords],
  );

  function openCreate(passport: Passport) {
    setDialogExisting(null);
    setDialogPassport(passport);
  }

  function openEdit(passport: Passport, record: SalaryRecord) {
    setDialogExisting(record);
    setDialogPassport(passport);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      invalidate();
      toast({ title: "Salary record deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  function handleConfirm(record: SalaryRecord) {
    const passport = (allPassports ?? []).find((p) => p.id === record.passportId);
    if (passport) {
      setDialogExisting({ ...record, status: "confirmed" });
      setDialogPassport(passport);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 pb-10">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Generator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generate and manage monthly salaries for all employees</p>
        </div>

        {/* Month / Year selector */}
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-950 to-indigo-800 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 opacity-70" />
              <span className="text-xs opacity-70 uppercase tracking-wide">Total Net Salary</span>
            </div>
            <p className="text-2xl font-bold">{fmtMVR(totalNet)}</p>
            <p className="text-xs opacity-60 mt-1">{MONTHS[month - 1]} {year}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Employees with Salary</span>
            </div>
            <p className="text-2xl font-bold">{(salaryRecords ?? []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">of {(allPassports ?? []).length} total employees</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Confirmed</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{confirmedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">salary records finalised</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name or passport number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
      </div>

      {/* Employee list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No employees found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const record = salaryMap.get(p.id) ?? null;
            return (
              <EmployeeRow
                key={p.id}
                passport={p}
                record={record}
                onGenerate={() => openCreate(p)}
                onEdit={() => record && openEdit(p, record)}
                onDelete={() => setDeleteTarget(record)}
              />
            );
          })}
        </div>
      )}

      {/* Generate / Edit dialog */}
      {dialogPassport && (
        <SalaryFormDialog
          open={dialogPassport !== null}
          onOpenChange={(v) => { if (!v) { setDialogPassport(null); setDialogExisting(null); } }}
          passport={dialogPassport}
          existing={dialogExisting}
          month={month}
          year={year}
          onSaved={invalidate}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete salary record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this salary record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmployeeRow({
  passport,
  record,
  onGenerate,
  onEdit,
  onDelete,
}: {
  passport: Passport;
  record: SalaryRecord | null;
  onGenerate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = (passport.fullName ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 hover:bg-muted/30 transition-colors">
      {/* Avatar */}
      <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{passport.fullName ?? "—"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {passport.passportNumber ?? "—"}
          {passport.nationality ? ` · ${passport.nationality}` : ""}
        </p>
      </div>

      {/* Salary info */}
      {record ? (
        <div className="hidden sm:flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold">{fmtMVR(record.netSalary)}</p>
            <p className="text-xs text-muted-foreground">net salary</p>
          </div>
          <StatusBadge status={record.status} />
        </div>
      ) : (
        <span className="hidden sm:block text-xs text-muted-foreground">No salary for this month</span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {record ? (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit} className="h-8 w-8 p-0">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onGenerate} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Generate
          </Button>
        )}
      </div>
    </div>
  );
}
