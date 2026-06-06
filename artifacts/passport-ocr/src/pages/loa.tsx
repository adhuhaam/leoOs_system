import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLoa,
  useCreateLoa,
  useDeleteLoa,
  useListPassports,
  useListCompanies,
  useCreateCompany,
  useListLoaOptions,
  getListLoaQueryKey,
  getListLoaOptionsQueryKey,
} from "@workspace/api-client-react";
import type { Loa, Passport, Company, LoaOption } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Trash2, Download, Printer, Building2, User, ChevronRight } from "lucide-react";

const STEPS = ["Select Company & Candidate", "Employment Details", "Signatory"] as const;
type Step = 0 | 1 | 2;

interface FormData {
  companyId: string;
  passportId: string;
  // snapshotted candidate
  candidateEmergencyContact: string;
  // employment
  jobTitle: string;
  workType: string;
  basicSalary: string;
  salaryPaymentDate: string;
  workSite: string;
  dateOfCommence: string;
  jobDescription: string;
  workingHours: string;
  workStatus: string;
  contractDuration: string;
  // signatory
  signatoryName: string;
  signatoryDesignation: string;
  signatureDate: string;
}

const DEFAULT_FORM: FormData = {
  companyId: "",
  passportId: "",
  candidateEmergencyContact: "",
  jobTitle: "",
  workType: "",
  basicSalary: "",
  salaryPaymentDate: "End of each month",
  workSite: "",
  dateOfCommence: "Date of Arrival",
  jobDescription: "Job Description will be given the time of signing the contract",
  workingHours: "09:00 to 17:00 Saturday to Sunday",
  workStatus: "Contract based",
  contractDuration: "Contract will be for 2 years, Probation period is 3 months",
  signatoryName: "",
  signatoryDesignation: "",
  signatureDate: new Date().toLocaleDateString("en-GB"),
};

function LoaTable({ entries, onDelete }: { entries: Loa[]; onDelete: (id: number) => void }) {
  const downloadPdf = (id: number, name: string | null) => {
    const a = document.createElement("a");
    a.href = `/api/loa/${id}/pdf`;
    a.download = `LOA-${name ?? id}.pdf`;
    a.click();
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="loa-empty-state">
        <FileText className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No LOA entries yet</p>
        <p className="text-xs mt-1">Click the + button to generate your first Letter of Appointment</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Candidate</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Company</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Job Title</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Created</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((loa) => (
            <tr key={loa.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-loa-${loa.id}`}>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{loa.id}</td>
              <td className="px-4 py-3 font-medium">{loa.candidateName || <span className="text-muted-foreground italic text-xs">—</span>}</td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{loa.companyName || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{loa.jobTitle || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                {new Date(loa.createdAt).toLocaleDateString("en-GB")}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/loa/${loa.id}/print`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View / Print LOA"
                      data-testid={`button-view-loa-${loa.id}`}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => downloadPdf(loa.id, loa.candidateName ?? null)}
                    title="Download PDF"
                    data-testid={`button-download-loa-${loa.id}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(loa.id)}
                    title="Delete"
                    data-testid={`button-delete-loa-${loa.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepOne({
  form,
  setForm,
  companies,
  passports,
  onNewCompany,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  companies: Company[];
  passports: Passport[];
  onNewCompany: () => void;
}) {
  const selectedPassport = passports.find((p) => String(p.id) === form.passportId);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Company (Employer)</Label>
          <button className="text-xs text-primary underline underline-offset-2" onClick={onNewCompany} data-testid="button-add-company">
            + Add new
          </button>
        </div>
        <Select
          value={form.companyId}
          onValueChange={(v) => {
            const c = companies.find((x) => String(x.id) === v);
            setForm({
              ...form,
              companyId: v,
              // Pre-fill signatory from the company's defaults — but only when
              // the user hasn't typed anything custom yet. This keeps switching
              // companies useful while not stomping on edits in step 3.
              signatoryName:
                form.signatoryName && form.signatoryName !== (companies.find((x) => String(x.id) === form.companyId)?.signatoryName ?? "")
                  ? form.signatoryName
                  : c?.signatoryName ?? "",
              signatoryDesignation:
                form.signatoryDesignation && form.signatoryDesignation !== (companies.find((x) => String(x.id) === form.companyId)?.signatoryDesignation ?? "")
                  ? form.signatoryDesignation
                  : c?.signatoryDesignation ?? "",
            });
          }}
        >
          <SelectTrigger data-testid="select-company">
            <SelectValue placeholder="Select a company..." />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} data-testid={`option-company-${c.id}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {companies.find((c) => String(c.id) === form.companyId) && (
          <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-0.5">
            {companies.find((c) => String(c.id) === form.companyId)?.address && (
              <p>{companies.find((c) => String(c.id) === form.companyId)?.address}</p>
            )}
            {companies.find((c) => String(c.id) === form.companyId)?.country && (
              <p>{companies.find((c) => String(c.id) === form.companyId)?.country}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Candidate (Employee)</Label>
        <Select value={form.passportId} onValueChange={(v) => setForm({ ...form, passportId: v })}>
          <SelectTrigger data-testid="select-candidate">
            <SelectValue placeholder={passports.length === 0 ? "No passport records yet — upload one first" : "Select a candidate..."} />
          </SelectTrigger>
          <SelectContent>
            {passports.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No passport records found. Upload a passport first from the "Process Document" page.
              </div>
            )}
            {passports.map((p) => {
              const label = p.fullName || `(unnamed)`;
              const num = p.passportNumber ? ` — ${p.passportNumber}` : "";
              const status = p.status !== "completed" ? ` [${p.status}]` : "";
              return (
                <SelectItem key={p.id} value={String(p.id)} data-testid={`option-candidate-${p.id}`}>
                  {label}{num}{status}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedPassport && (
          <div className="rounded-md bg-muted/50 border border-border p-3 text-xs space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>Nationality: <span className="text-foreground capitalize">{selectedPassport.nationality}</span></span>
              <span>DOB: <span className="text-foreground">{selectedPassport.dateOfBirth}</span></span>
              <span>Passport: <span className="text-foreground font-mono">{selectedPassport.passportNumber}</span></span>
            </div>
            {selectedPassport.address && (
              <p className="text-muted-foreground">Address: <span className="text-foreground">{selectedPassport.address}</span></p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Emergency Contact (name & number)</Label>
        <Input
          placeholder="e.g. Jane Doe, +880-123-456789"
          value={form.candidateEmergencyContact}
          onChange={(e) => setForm({ ...form, candidateEmergencyContact: e.target.value })}
          data-testid="input-emergency-contact"
        />
      </div>
    </div>
  );
}

function OptionPicker({
  label,
  value,
  onChange,
  options,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: LoaOption[];
  placeholder: string;
  testId: string;
}) {
  // Allow free-text fallback when the current value isn't in the saved list.
  const inList = !value || options.some((o) => o.value === value);
  const [customMode, setCustomMode] = useState(!inList && !!value);

  const showCustom = customMode || options.length === 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {options.length > 0 && (
          <button
            type="button"
            className="text-[10px] text-primary hover:underline"
            onClick={() => {
              setCustomMode((m) => !m);
              if (!customMode) onChange("");
            }}
            data-testid={`button-toggle-custom-${testId}`}
          >
            {showCustom ? "Pick from list" : "Type custom"}
          </button>
        )}
      </div>
      {showCustom ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={options.length === 0 ? `${placeholder} (add to Settings to enable dropdown)` : placeholder}
          data-testid={`input-${testId}`}
        />
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={`select-${testId}`}>
            <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.value} data-testid={`option-${testId}-${o.id}`}>
                {o.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function StepTwo({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  const companyId = form.companyId ? Number(form.companyId) : 0;
  const enabled = !!form.companyId;

  const { data: jobTitles = [] } = useListLoaOptions(
    { companyId, category: "job_title" },
    { query: { enabled, queryKey: getListLoaOptionsQueryKey({ companyId, category: "job_title" }) } }
  );
  const { data: workTypes = [] } = useListLoaOptions(
    { companyId, category: "work_type" },
    { query: { enabled, queryKey: getListLoaOptionsQueryKey({ companyId, category: "work_type" }) } }
  );
  const { data: workSites = [] } = useListLoaOptions(
    { companyId, category: "work_site" },
    { query: { enabled, queryKey: getListLoaOptionsQueryKey({ companyId, category: "work_site" }) } }
  );

  const f = (key: keyof FormData, label: string, placeholder?: string, multiline?: boolean) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea
          rows={2}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      ) : (
        <Input
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      )}
    </div>
  );

  const noOptions = jobTitles.length === 0 && workTypes.length === 0 && workSites.length === 0;

  return (
    <div className="space-y-4">
      {noOptions && enabled && (
        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Tip: Add Job Titles, Work Types, and Work Sites for this company in{" "}
          <Link href="/companies" className="text-primary font-medium hover:underline">
            Companies
          </Link>{" "}
          to enable dropdowns here.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <OptionPicker
          label="Job Title / Occupation"
          value={form.jobTitle}
          onChange={(v) => setForm({ ...form, jobTitle: v })}
          options={jobTitles}
          placeholder="e.g. Construction Worker"
          testId="jobTitle"
        />
        <OptionPicker
          label="Work Type"
          value={form.workType}
          onChange={(v) => setForm({ ...form, workType: v })}
          options={workTypes}
          placeholder="e.g. Manual Labour"
          testId="workType"
        />
        {f("basicSalary", "Basic Salary (USD)", "e.g. 500")}
        {f("salaryPaymentDate", "Date of Salary Payment")}
        <OptionPicker
          label="Work Site"
          value={form.workSite}
          onChange={(v) => setForm({ ...form, workSite: v })}
          options={workSites}
          placeholder="e.g. Guraidhoo, Maldives"
          testId="workSite"
        />
        {f("dateOfCommence", "Date of Commence")}
        {f("workStatus", "Work Status")}
        {f("contractDuration", "Contract Duration")}
      </div>
      {f("workingHours", "Working Hours")}
      {f("jobDescription", "Job Description", "", true)}
    </div>
  );
}

function StepThree({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Signatory Name</Label>
        <Input
          value={form.signatoryName}
          onChange={(e) => setForm({ ...form, signatoryName: e.target.value })}
          placeholder="Full name of the signing authority"
          data-testid="input-signatoryName"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Signatory Designation</Label>
        <Input
          value={form.signatoryDesignation}
          onChange={(e) => setForm({ ...form, signatoryDesignation: e.target.value })}
          placeholder="e.g. Managing Director"
          data-testid="input-signatoryDesignation"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Signature Date</Label>
        <Input
          value={form.signatureDate}
          onChange={(e) => setForm({ ...form, signatureDate: e.target.value })}
          placeholder="DD/MM/YYYY"
          data-testid="input-signatureDate"
        />
      </div>
    </div>
  );
}

function AddCompanyDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (c: Company) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [regNum, setRegNum] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");
  const createCompany = useCreateCompany();
  const { toast } = useToast();

  const handleSave = () => {
    if (!name.trim()) return;
    createCompany.mutate(
      {
        data: {
          name,
          address: address || undefined,
          email: email || undefined,
          phone: phone || undefined,
          country: country || undefined,
          registrationNumber: regNum || undefined,
          signatoryName: signatoryName || undefined,
          signatoryDesignation: signatoryDesignation || undefined,
        },
      },
      {
        onSuccess: (company) => {
          toast({ title: "Company saved" });
          onSaved(company);
          onClose();
        },
        onError: () => toast({ title: "Failed to save company", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Company</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Company Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-company-name" /></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-company-address" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-company-email" /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+960 999 0000" data-testid="input-company-phone" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} data-testid="input-company-country" /></div>
            <div className="space-y-1.5"><Label>Registration Number</Label><Input value={regNum} onChange={(e) => setRegNum(e.target.value)} data-testid="input-company-regnum" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
            <div className="space-y-1.5"><Label>Signatory Name</Label><Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Abdulla Muneeb" data-testid="input-company-signatory-name" /></div>
            <div className="space-y-1.5"><Label>Designation</Label><Input value={signatoryDesignation} onChange={(e) => setSignatoryDesignation(e.target.value)} placeholder="Managing Director" data-testid="input-company-signatory-designation" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || createCompany.isPending} data-testid="button-save-company">Save Company</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LoaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: loas = [], isLoading } = useListLoa();
  const { data: passports = [] } = useListPassports();
  const { data: companies = [] } = useListCompanies();

  const createLoa = useCreateLoa();
  const deleteLoa = useDeleteLoa();

  const [createOpen, setCreateOpen] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const selectedCompany = companies.find((c) => String(c.id) === form.companyId);
  const selectedPassport = passports.find((p) => String(p.id) === form.passportId);

  const canNext = () => {
    if (step === 0) return !!form.companyId && !!form.passportId;
    if (step === 1) return !!form.jobTitle.trim();
    return !!form.signatoryName.trim();
  };

  const handleGenerate = () => {
    if (!selectedCompany || !selectedPassport) return;

    createLoa.mutate(
      {
        data: {
          companyId: Number(form.companyId),
          passportId: Number(form.passportId),
          // Snapshot company
          companyName: selectedCompany.name,
          companyAddress: selectedCompany.address ?? undefined,
          companyEmail: selectedCompany.email ?? undefined,
          companyPhone: selectedCompany.phone ?? undefined,
          companyCountry: selectedCompany.country ?? undefined,
          companyRegistrationNumber: selectedCompany.registrationNumber ?? undefined,
          // Snapshot candidate
          candidateName: selectedPassport.fullName ?? undefined,
          candidateAddress: selectedPassport.address ?? undefined,
          candidateNationality: selectedPassport.nationality ?? undefined,
          candidateDateOfBirth: selectedPassport.dateOfBirth ?? undefined,
          candidatePassportNumber: selectedPassport.passportNumber ?? undefined,
          candidateEmergencyContact: form.candidateEmergencyContact || undefined,
          // Employment
          jobTitle: form.jobTitle,
          workType: form.workType,
          basicSalary: form.basicSalary,
          salaryPaymentDate: form.salaryPaymentDate,
          workSite: form.workSite,
          dateOfCommence: form.dateOfCommence,
          jobDescription: form.jobDescription,
          workingHours: form.workingHours,
          workStatus: form.workStatus,
          contractDuration: form.contractDuration,
          // Signatory
          signatoryName: form.signatoryName,
          signatoryDesignation: form.signatoryDesignation,
          signatureDate: form.signatureDate,
        },
      },
      {
        onSuccess: (loa) => {
          queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() });
          toast({ title: "LOA generated", description: "Downloading PDF..." });
          // Auto-download
          setTimeout(() => {
            const a = document.createElement("a");
            a.href = `/api/loa/${loa.id}/pdf`;
            a.download = `LOA-${selectedPassport.fullName?.replace(/\s+/g, "-") ?? loa.id}.pdf`;
            a.click();
          }, 300);
          setCreateOpen(false);
          setStep(0);
          setForm(DEFAULT_FORM);
        },
        onError: () => toast({ title: "Failed to generate LOA", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteLoa.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() });
          toast({ title: "LOA deleted" });
          setDeleteId(null);
        },
        onError: () => toast({ title: "Failed to delete LOA", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Letter of Appointment</h1>
          <p className="text-muted-foreground mt-1 text-sm">Generate and manage LOA documents for candidates.</p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setStep(0); setForm(DEFAULT_FORM); }} data-testid="button-create-loa">
          <Plus className="h-4 w-4 mr-1" /> Generate LOA
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">Total: <strong className="text-foreground">{loas.length}</strong></span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <LoaTable entries={loas} onDelete={setDeleteId} />
      )}

      {/* Create LOA Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setStep(0); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Letter of Appointment</DialogTitle>
            {/* Step indicator */}
            <div className="flex items-center gap-1 pt-2">
              {STEPS.map((label, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors
                    ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
                      border border-current">{i + 1}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="py-2">
            {step === 0 && (
              <StepOne
                form={form}
                setForm={setForm}
                companies={companies}
                passports={passports}
                onNewCompany={() => setAddCompanyOpen(true)}
              />
            )}
            {step === 1 && <StepTwo form={form} setForm={setForm} />}
            {step === 2 && <StepThree form={form} setForm={setForm} />}
          </div>

          <DialogFooter className="gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => { setCreateOpen(false); setStep(0); }}>Cancel</Button>
            {step < 2 ? (
              <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canNext()} data-testid="button-next-step">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!canNext() || createLoa.isPending}
                data-testid="button-generate-loa"
              >
                {createLoa.isPending ? "Generating..." : "Generate & Download PDF"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <AddCompanyDialog
        open={addCompanyOpen}
        onClose={() => setAddCompanyOpen(false)}
        onSaved={(c) => {
          queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
          setForm((f) => ({ ...f, companyId: String(c.id) }));
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete LOA?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this Letter of Appointment. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-loa">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
