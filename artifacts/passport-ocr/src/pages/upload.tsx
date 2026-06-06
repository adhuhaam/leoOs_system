import React, { useState, useRef, useEffect } from "react";
import {
  useUploadPassport,
  useGetPassport,
  useUpdatePassport,
  useListCompanies,
  useListLoaOptions,
  useCreateLoa,
  getGetPassportQueryKey,
  getListLoaOptionsQueryKey,
} from "@workspace/api-client-react";
import type { Company } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  File as FileIcon,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Building2,
  FileText,
  Download,
  Eye,
  ChevronRight,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "upload" | "assign" | "done";

interface AssignForm {
  companyId: string;
  emergencyContact: string;
  jobTitle: string;
  workType: string;
  workSite: string;
  basicSalary: string;
  salaryPaymentDate: string;
  workingHours: string;
  workStatus: string;
  contractDuration: string;
  dateOfCommence: string;
  jobDescription: string;
  signatoryName: string;
  signatoryDesignation: string;
  signatureDate: string;
}

const DEFAULT_ASSIGN: AssignForm = {
  companyId: "",
  emergencyContact: "",
  jobTitle: "",
  workType: "",
  workSite: "",
  basicSalary: "",
  salaryPaymentDate: "End of each month",
  workingHours: "09:00 to 17:00 Saturday to Sunday",
  workStatus: "Contract based",
  contractDuration: "Contract will be for 2 years, Probation period is 3 months",
  dateOfCommence: "Date of Arrival",
  jobDescription: "Job Description will be given the time of signing the contract",
  signatoryName: "",
  signatoryDesignation: "",
  signatureDate: new Date().toLocaleDateString("en-GB"),
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "upload", label: "Upload & Extract" },
  { id: "assign", label: "Assign & Details" },
  { id: "done", label: "Complete" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors
              ${i === idx
                ? "bg-primary text-primary-foreground"
                : i < idx
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"}`}
          >
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Option picker (dropdown or free-text) ────────────────────────────────────

function OptionPicker({
  label,
  value,
  onChange,
  options,
  placeholder,
  testId,
  isLoading,
  companySelected,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: number; value: string }[];
  placeholder: string;
  testId: string;
  isLoading?: boolean;
  companySelected?: boolean;
}) {
  const hasOptions = options.length > 0;
  const inList = !value || options.some((o) => o.value === value);
  const [customMode, setCustomMode] = useState(!inList && !!value);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <Select disabled>
          <SelectTrigger className="text-muted-foreground" data-testid={`select-${testId}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2 inline" />
            <span className="text-xs">Loading…</span>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  // No options configured for this company — show text input with a setup hint
  if (!hasOptions && companySelected) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={`input-${testId}`}
          className="border-amber-300 focus-visible:ring-amber-400"
        />
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          No options configured.{" "}
          <a href="/companies" className="underline hover:text-amber-800 dark:hover:text-amber-200">
            Add {label.toLowerCase()} options
          </a>{" "}
          in the Companies page to use a dropdown here.
        </p>
      </div>
    );
  }

  // Options available — dropdown with optional "Type custom" escape hatch
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {hasOptions && (
          <button
            type="button"
            className="text-[10px] text-primary hover:underline"
            onClick={() => {
              setCustomMode((m) => !m);
              if (!customMode) onChange("");
            }}
          >
            {customMode ? "Pick from list" : "Type custom"}
          </button>
        )}
      </div>
      {customMode ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={`input-${testId}`}
        />
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={`select-${testId}`}>
            <SelectValue placeholder={`Select ${label.toLowerCase()}…`} />
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

// ─── Step 2: Assign company + employment details ──────────────────────────────

function AssignStep({
  form,
  setForm,
  companies,
}: {
  form: AssignForm;
  setForm: React.Dispatch<React.SetStateAction<AssignForm>>;
  companies: Company[];
}) {
  const companyId = form.companyId ? Number(form.companyId) : 0;
  const enabled = !!form.companyId;

  const { data: jobTitles = [], isLoading: loadingJobTitles } = useListLoaOptions(
    { companyId, category: "job_title" },
    { query: { enabled, queryKey: getListLoaOptionsQueryKey({ companyId, category: "job_title" }) } }
  );
  const { data: workTypes = [], isLoading: loadingWorkTypes } = useListLoaOptions(
    { companyId, category: "work_type" },
    { query: { enabled, queryKey: getListLoaOptionsQueryKey({ companyId, category: "work_type" }) } }
  );
  const { data: workSites = [], isLoading: loadingWorkSites } = useListLoaOptions(
    { companyId, category: "work_site" },
    { query: { enabled, queryKey: getListLoaOptionsQueryKey({ companyId, category: "work_site" }) } }
  );

  const selectedCompany = companies.find((c) => String(c.id) === form.companyId);

  const f = (
    key: keyof AssignForm,
    label: string,
    placeholder?: string,
    multiline?: boolean
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {multiline ? (
        <Textarea
          rows={2}
          value={form[key]}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      ) : (
        <Input
          value={form[key]}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Company picker */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            Company Assignment
          </span>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Company (Employer) <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.companyId}
            onValueChange={(v) => {
              const c = companies.find((x) => String(x.id) === v);
              setForm((s) => ({
                ...s,
                companyId: v,
                // Reset LOA option fields so pickers remount with the new company's options
                jobTitle: "",
                workType: "",
                workSite: "",
                signatoryName: c?.signatoryName ?? s.signatoryName,
                signatoryDesignation: c?.signatoryDesignation ?? s.signatoryDesignation,
              }));
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
          {selectedCompany && (
            <div className="rounded-md bg-muted/50 border border-border p-2.5 text-xs text-muted-foreground space-y-0.5">
              {selectedCompany.address && <p>{selectedCompany.address}</p>}
              {selectedCompany.country && <p>{selectedCompany.country}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Employment details — only show when a company is selected */}
      {form.companyId && (
        <>
          <div className="pt-1 border-t border-border/60">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                Employment Details
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <OptionPicker
                key={`jobTitle-${form.companyId}`}
                label="Job Title / Occupation"
                value={form.jobTitle}
                onChange={(v) => setForm((s) => ({ ...s, jobTitle: v }))}
                options={jobTitles}
                isLoading={loadingJobTitles}
                placeholder="e.g. Construction Worker"
                testId="jobTitle"
                companySelected={enabled}
              />
              <OptionPicker
                key={`workType-${form.companyId}`}
                label="Work Type"
                value={form.workType}
                onChange={(v) => setForm((s) => ({ ...s, workType: v }))}
                options={workTypes}
                isLoading={loadingWorkTypes}
                placeholder="e.g. Manual Labour"
                testId="workType"
                companySelected={enabled}
              />
              {f("basicSalary", "Basic Salary (USD)", "e.g. 500")}
              {f("salaryPaymentDate", "Salary Payment Date")}
              <OptionPicker
                key={`workSite-${form.companyId}`}
                label="Work Site"
                value={form.workSite}
                onChange={(v) => setForm((s) => ({ ...s, workSite: v }))}
                options={workSites}
                isLoading={loadingWorkSites}
                placeholder="e.g. Guraidhoo, Maldives"
                testId="workSite"
                companySelected={enabled}
              />
              {f("dateOfCommence", "Date of Commence")}
              {f("workStatus", "Work Status")}
              {f("contractDuration", "Contract Duration")}
            </div>
            {f("workingHours", "Working Hours")}
            {f("jobDescription", "Job Description", "", true)}
          </div>

          <div className="pt-1 border-t border-border/60">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                Candidate &amp; Signatory
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {f("emergencyContact", "Emergency Contact", "e.g. Jane Doe, +880-123-456789")}
              {f("signatoryName", "Signatory Name", "Full name of signing authority")}
              {f("signatoryDesignation", "Signatory Designation", "e.g. Managing Director")}
              {f("signatureDate", "Signature Date", "DD/MM/YYYY")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 3: Done ──────────────────────────────────────────────────────────────

function DoneStep({
  loaId,
  candidateName,
  companyName,
  onReset,
}: {
  loaId: number;
  candidateName: string | null;
  companyName: string | null;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Passport processed &amp; LOA created</h3>
              {candidateName && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {candidateName}
                  {companyName && <> · {companyName}</>}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <a href={`/api/loa/${loaId}/pdf`} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" /> View LOA
          </a>
        </Button>
        <Button asChild>
          <a
            href={`/api/loa/${loaId}/pdf`}
            download={`LOA-${candidateName?.replace(/\s+/g, "-") ?? loaId}.pdf`}
          >
            <Download className="h-4 w-4 mr-2" /> Download LOA PDF
          </a>
        </Button>
      </div>

      <div className="pt-2 border-t border-border/60 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href="/master-list">
            <Users className="h-4 w-4 mr-2" /> Go to Master List
          </a>
        </Button>
        <Button variant="ghost" onClick={onReset} data-testid="button-process-another">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Process another document
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [activePassportId, setActivePassportId] = useState<number | null>(null);
  const [assignForm, setAssignForm] = useState<AssignForm>(DEFAULT_ASSIGN);
  const [createdLoaId, setCreatedLoaId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const uploadMutation = useUploadPassport();
  const updatePassportMutation = useUpdatePassport();
  const createLoaMutation = useCreateLoa();
  const { data: companies = [] } = useListCompanies();

  const { data: passport, isError: passportNotFound } = useGetPassport(activePassportId as number, {
    query: {
      enabled: !!activePassportId,
      queryKey: getGetPassportQueryKey(activePassportId as number),
      retry: false,
      refetchInterval: (query) => {
        const data = query.state.data;
        // Stop polling once complete, failed, or the record was deleted (404)
        if (data && (data.status === "completed" || data.status === "failed")) return false;
        if (query.state.error) return false;
        return 2000;
      },
    },
  });

  // Auto-advance to assign step when OCR completes
  useEffect(() => {
    if (passport?.status === "completed" && step === "upload") {
      // Don't auto-advance — let user click "Continue"
    }
  }, [passport?.status, step]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (selectedFile: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WEBP or PDF file.",
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
    setActivePassportId(null);
  };

  const handleUpload = () => {
    if (!file) return;
    uploadMutation.mutate(
      { data: { file } },
      {
        onSuccess: (data) => {
          toast({ title: "Upload successful", description: "Document queued for processing." });
          setActivePassportId(data.id);
        },
        onError: () =>
          toast({
            title: "Upload failed",
            description: "There was an error uploading the document.",
            variant: "destructive",
          }),
      }
    );
  };

  const handleCreateLoa = () => {
    if (!passport || !activePassportId || !assignForm.companyId) return;

    const selectedCompany = companies.find((c) => String(c.id) === assignForm.companyId);
    const cid = Number(assignForm.companyId);

    // Step 1: assign company to passport. Step 2 (LOA creation) only runs on success
    // so company assignment is guaranteed before the LOA record exists.
    updatePassportMutation.mutate(
      { id: activePassportId, data: { companyId: cid } },
      {
        onError: () =>
          toast({ title: "Failed to assign company", description: "Please try again.", variant: "destructive" }),
        onSuccess: () => {
          // Step 2: create LOA now that passport.companyId is persisted
          createLoaMutation.mutate(
            {
              data: {
                companyId: cid,
                passportId: activePassportId,
                // Snapshot company
                companyName: selectedCompany?.name,
                companyAddress: selectedCompany?.address ?? undefined,
                companyEmail: selectedCompany?.email ?? undefined,
                companyPhone: selectedCompany?.phone ?? undefined,
                companyCountry: selectedCompany?.country ?? undefined,
                companyRegistrationNumber: selectedCompany?.registrationNumber ?? undefined,
                // Snapshot candidate
                candidateName: passport.fullName ?? undefined,
                candidateAddress: passport.address ?? undefined,
                candidateNationality: passport.nationality ?? undefined,
                candidateDateOfBirth: passport.dateOfBirth ?? undefined,
                candidatePassportNumber: passport.passportNumber ?? undefined,
                candidateEmergencyContact: assignForm.emergencyContact || undefined,
                // Employment
                jobTitle: assignForm.jobTitle || undefined,
                workType: assignForm.workType || undefined,
                basicSalary: assignForm.basicSalary || undefined,
                salaryPaymentDate: assignForm.salaryPaymentDate || undefined,
                workSite: assignForm.workSite || undefined,
                dateOfCommence: assignForm.dateOfCommence || undefined,
                jobDescription: assignForm.jobDescription || undefined,
                workingHours: assignForm.workingHours || undefined,
                workStatus: assignForm.workStatus || undefined,
                contractDuration: assignForm.contractDuration || undefined,
                signatoryName: assignForm.signatoryName || undefined,
                signatoryDesignation: assignForm.signatoryDesignation || undefined,
                signatureDate: assignForm.signatureDate || undefined,
              },
            },
            {
              onSuccess: (loa) => {
                setCreatedLoaId(loa.id);
                setStep("done");
                toast({ title: "LOA created successfully" });
              },
              onError: () =>
                toast({ title: "Failed to create LOA", variant: "destructive" }),
            }
          );
        },
      }
    );
  };

  const reset = () => {
    setFile(null);
    setActivePassportId(null);
    setAssignForm(DEFAULT_ASSIGN);
    setCreatedLoaId(null);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectedCompanyForDone = companies.find((c) => String(c.id) === assignForm.companyId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            AI Vision · GPT
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Process Document</h1>
        <p className="text-muted-foreground mt-2">
          Upload a passport image or PDF — fields are extracted automatically, then assign a company and generate an LOA.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          {!activePassportId ? (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div
                  className={`relative rounded-xl border-2 border-dashed p-10 md:p-16 text-center transition-all duration-200
                    ${dragActive
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-border bg-gradient-to-b from-muted/30 to-transparent hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.pdf,.webp"
                    onChange={handleChange}
                  />
                  <div className="mx-auto flex max-w-[460px] flex-col items-center justify-center text-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 blur-xl" />
                      <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <UploadCloud className="h-9 w-9 text-white" />
                      </div>
                    </div>
                    <h3 className="mt-6 text-lg md:text-xl font-semibold tracking-tight">
                      Drop your document here
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      or click to browse · Supports JPEG, PNG, WEBP, PDF · Max 20MB
                    </p>
                    <Button
                      className="mt-5 shadow-sm"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-browse"
                    >
                      <UploadCloud className="h-4 w-4 mr-2" /> Browse Files
                    </Button>
                    <div className="mt-6 flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" /> Secure
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-violet-500" /> GPT Vision
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-amber-500" /> ~5s avg
                      </span>
                    </div>
                  </div>
                </div>

                {file && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4 border border-border/60 rounded-lg bg-card shadow-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <FileIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={reset}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleUpload}
                        disabled={uploadMutation.isPending}
                        data-testid="button-submit-upload"
                        className="shadow-sm"
                      >
                        {uploadMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-3.5 w-3.5" /> Begin Extraction
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm
                        ${passport?.status === "completed"
                          ? "bg-gradient-to-br from-emerald-500 to-teal-500"
                          : (passport?.status === "failed" || passportNotFound)
                          ? "bg-gradient-to-br from-rose-500 to-red-500"
                          : "bg-gradient-to-br from-amber-500 to-orange-500"}`}
                    >
                      {passport?.status === "processing" && !passportNotFound && (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      )}
                      {passport?.status === "completed" && (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      )}
                      {(passport?.status === "failed" || passportNotFound) && (
                        <AlertCircle className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {!passportNotFound && passport?.status === "processing" && "Extracting data..."}
                        {passport?.status === "completed" && "Extraction complete"}
                        {(passport?.status === "failed" || passportNotFound) && "Extraction failed"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {file?.name || passport?.originalFilename}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reset}
                    data-testid="button-process-another"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New Document
                  </Button>
                </div>

                {(passport?.status === "failed" || passportNotFound) && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Extraction Failed</AlertTitle>
                    <AlertDescription>
                      {passportNotFound
                        ? "OCR extraction failed. The document could not be read — please try again with a clearer image."
                        : (passport?.errorMessage || "An unknown error occurred during OCR processing.")}
                    </AlertDescription>
                  </Alert>
                )}

                {passport?.status === "completed" && (
                  <>
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <DataRow label="Full Name" value={passport.fullName} />
                      <DataRow label="Passport Number" value={passport.passportNumber} mono />
                      <DataRow label="Nationality" value={passport.nationality} />
                      <DataRow label="Date of Birth" value={passport.dateOfBirth} />
                      <DataRow label="Date of Issue" value={passport.dateOfIssue} />
                      <DataRow label="Date of Expiry" value={passport.dateOfExpiry} />
                      <div className="col-span-1 md:col-span-2">
                        <DataRow label="Address" value={passport.address} />
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-border/60 flex justify-end">
                      <Button
                        onClick={() => setStep("assign")}
                        data-testid="button-continue-assign"
                      >
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </>
                )}

                {passport?.status === "processing" && !passportNotFound && (
                  <div className="mt-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Step 2: Assign ── */}
      {step === "assign" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6">
            {passport && (
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
                <Badge variant="secondary" className="text-xs">
                  {passport.nationality ?? "Unknown"}
                </Badge>
                <span className="text-sm font-medium">{passport.fullName ?? "(unnamed)"}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {passport.passportNumber}
                </span>
              </div>
            )}

            {companies.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No companies configured yet. Go to{" "}
                <a href="/companies" className="text-primary font-medium hover:underline">
                  Companies
                </a>{" "}
                to add one first.
              </div>
            ) : (
              <AssignStep form={assignForm} setForm={setAssignForm} companies={companies} />
            )}

            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border/60">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={handleCreateLoa}
                disabled={!assignForm.companyId || createLoaMutation.isPending}
                data-testid="button-create-loa"
              >
                {createLoaMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    Generate LOA <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Done ── */}
      {step === "done" && createdLoaId != null && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6">
            <DoneStep
              loaId={createdLoaId}
              candidateName={passport?.fullName ?? null}
              companyName={selectedCompanyForDone?.name ?? null}
              onReset={reset}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 pb-3 border-b border-border/60">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`text-sm font-medium text-foreground ${mono ? "font-mono uppercase tracking-wide" : ""}`}
      >
        {value || (
          <span className="text-muted-foreground/50 italic font-normal normal-case">
            Not detected
          </span>
        )}
      </dd>
    </div>
  );
}
