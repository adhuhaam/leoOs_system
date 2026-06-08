import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useGetLoa, useListCompanies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";

function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  const s = v.trim();
  // ISO date → DD/MM/YYYY
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-x-1 text-[11px] leading-snug py-[3px]">
      <span className="font-semibold text-slate-800 shrink-0">{label}:</span>
      <span className="text-slate-700">{(value ?? "").trim() || "—"}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-bold text-slate-900 mt-5 mb-1 border-b border-slate-200 pb-0.5">
      {children}
    </p>
  );
}

export default function LoaPrintPage() {
  const [, params] = useRoute("/loa/:id/print");
  const id = params?.id ? Number(params.id) : 0;

  const { data: loa, isLoading } = useGetLoa(id);
  const { data: companies = [] } = useListCompanies({ withBranding: true });

  // Prefer live company branding; fall back to snapshotted values on the LOA.
  const company = companies.find((c) => c.id === loa?.companyId);
  const letterheadImage = company?.letterheadImage ?? null;
  const signatureImage = company?.signatureImage ?? null;
  const signatoryName = loa?.signatoryName ?? company?.signatoryName ?? "";
  const signatoryDesignation =
    loa?.signatoryDesignation ?? company?.signatoryDesignation ?? "";

  // Page title for "Save as PDF" filename suggestion.
  useEffect(() => {
    if (!loa?.candidateName) return undefined;
    const prev = document.title;
    document.title = `LOA-${loa.candidateName}`;
    return () => {
      document.title = prev;
    };
  }, [loa?.candidateName]);

  // Print-only stylesheet — same technique as billing-print.tsx.
  useEffect(() => {
    const css = `
      @page { size: A4; margin: 14mm; }
      @media print {
        html, body { background: white !important; }
        .no-print { display: none !important; }
        .print-outer {
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
        }
        .print-shell {
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          max-width: none !important;
          margin: 0 !important;
        }
        .print-page { padding: 0 !important; }
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (isLoading || !loa) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  const companyName =
    loa.companyName ??
    company?.name ??
    "";
  const companyAddress = loa.companyAddress ?? company?.address ?? "";
  const companyEmail = loa.companyEmail ?? company?.email ?? "";
  const companyPhone = loa.companyPhone ?? company?.phone ?? "";
  const companyCountry = loa.companyCountry ?? company?.country ?? "";
  const companyReg =
    loa.companyRegistrationNumber ?? company?.registrationNumber ?? "";

  return (
    <div className="print-outer bg-slate-100 min-h-screen py-2 sm:py-6">
      {/* ── Toolbar (hidden on print) ── */}
      <div className="no-print max-w-[820px] mx-auto px-3 sm:px-4 mb-2 sm:mb-4 flex items-center justify-between">
        <Link href="/loa">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => window.print()}
          data-testid="button-print"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      {/* ── A4 document ── */}
      <div className="print-shell max-w-[820px] mx-auto bg-white text-slate-900 shadow-lg">
        <div className="print-page px-4 py-6 sm:p-12 text-[11.5px] leading-relaxed font-sans">

          {/* ── Company letterhead ── */}
          {letterheadImage ? (
            <div className="flex justify-center mb-4">
              <img
                src={letterheadImage}
                alt={companyName}
                className="max-h-24 max-w-[420px] object-contain"
              />
            </div>
          ) : (
            <div className="text-center mb-4">
              <p className="text-[15px] font-bold uppercase tracking-wide text-slate-900">
                {companyName}
              </p>
              {companyAddress && (
                <p className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-line">
                  {companyAddress}
                </p>
              )}
              {(companyPhone || companyEmail) && (
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {[companyPhone, companyEmail].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* ── Title ── */}
          <div className="text-center my-5">
            <h1 className="text-[15px] font-bold uppercase tracking-widest text-slate-900 border-y border-slate-300 py-2 inline-block px-6">
              Letter of Appointment
            </h1>
          </div>

          {/* ── 1. Employer ── */}
          <SectionHeader>1. Details of Employer;</SectionHeader>
          <FieldRow label="Name" value={companyName} />
          <FieldRow label="Address" value={companyAddress} />
          <FieldRow
            label="Contact Details / Email address"
            value={companyEmail}
          />
          <FieldRow label="Phone Number" value={companyPhone} />
          <FieldRow label="Country of origin" value={companyCountry} />
          <FieldRow
            label="Registration Number / ID Card"
            value={companyReg}
          />

          {/* ── 2. Employee ── */}
          <SectionHeader>2. Details of Employee;</SectionHeader>
          <FieldRow label="Name" value={loa.candidateName} />
          <FieldRow label="Permanent Address" value={loa.candidateAddress} />
          <FieldRow label="Nationality" value={loa.candidateNationality} />
          <FieldRow
            label="Date of Birth"
            value={formatDate(loa.candidateDateOfBirth)}
          />
          <FieldRow
            label="Passport Number"
            value={loa.candidatePassportNumber}
          />
          <FieldRow
            label="Emergency Contact Details (name and contact number)"
            value={loa.candidateEmergencyContact}
          />

          {/* ── 4. Employment ── */}
          <SectionHeader>4. Details of Employment;</SectionHeader>
          <FieldRow label="Job Title / Occupation" value={loa.jobTitle} />
          <FieldRow label="Work Type" value={loa.workType} />
          <FieldRow label="Basic Salary (USD)" value={loa.basicSalary} />
          <FieldRow
            label="Date of Salary payment"
            value={loa.salaryPaymentDate ?? "End of each month"}
          />
          <FieldRow label="Work site" value={loa.workSite} />
          <FieldRow
            label="Date of Commence"
            value={loa.dateOfCommence ?? "Date of Arrival"}
          />
          <FieldRow
            label="Job Description"
            value={
              loa.jobDescription ??
              "Job Description will be given the time of signing the contract"
            }
          />
          <FieldRow
            label="Working Hours"
            value={
              loa.workingHours ??
              "09:00 to 17:00 Saturday to Sunday"
            }
          />
          <FieldRow
            label="Work Status (Permanent / Contract)"
            value={loa.workStatus ?? "Contract based"}
          />
          <FieldRow
            label="Contract Duration (if Contracted employee)"
            value={
              loa.contractDuration ??
              "Contract will be for 2 years, Probation period is 3 months"
            }
          />

          {/* ── Signatory ── */}
          <SectionHeader>Details of Signatory;</SectionHeader>
          <FieldRow label="Name" value={signatoryName} />
          <FieldRow label="Designation" value={signatoryDesignation} />

          {/* ── Signature block ── */}
          <div className="mt-8">
            {signatureImage ? (
              <img
                src={signatureImage}
                alt="Signature"
                className="max-h-16 max-w-[180px] object-contain mb-1"
              />
            ) : (
              <div className="border-b border-slate-400 w-48 mb-1 h-10" />
            )}
            <p className="text-[11px] font-semibold text-slate-900">
              {signatoryName}
            </p>
            {signatoryDesignation && (
              <p className="text-[10.5px] text-slate-600">
                {signatoryDesignation}
              </p>
            )}
            <p className="text-[11px] text-slate-700 mt-1">
              Date: {formatDate(loa.signatureDate)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
