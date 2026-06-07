import { useParams, useLocation } from "wouter";
import {
  useGetPassport,
  useListLoa,
  useGetXpatWorkPermit,
  getGetXpatWorkPermitQueryKey,
} from "@workspace/api-client-react";
import type { XpatWorkPermit, Loa, Passport } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  FileText,
  Briefcase,
  Globe,
  User,
  Hash,
  Calendar,
  MapPin,
  Phone,
  Edit,
} from "lucide-react";

const XPAT_15_MIN = 15 * 60 * 1000;

// ─── Status meta ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  processing:                { label: "Processing",        cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  completed:                 { label: "OCR Done",          cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  failed:                    { label: "OCR Failed",        cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  applied:                   { label: "Applied",           cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  approved:                  { label: "Approved",          cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  ticket_issued:             { label: "Ticket Issued",     cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  arrived:                   { label: "Arrived",           cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  handedover:                { label: "Handed Over",       cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  return_back_from_worksite: { label: "Returned",          cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  incomplete:                { label: "Incomplete",        cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  cancelled:                 { label: "Cancelled",         cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  terminated:                { label: "Terminated",        cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  lost:                      { label: "Lost",              cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" },
  employed:                  { label: "Employed",          cls: "bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-200" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPhotoSrc(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  return `/api/xpat/photo?photoUrl=${encodeURIComponent(photoUrl)}`;
}

function formatXpatDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isWpValid(v: string | null | undefined) {
  return v != null && v.toLowerCase() === "valid";
}
function isWpInvalid(v: string | null | undefined) {
  return v != null && v.toLowerCase() !== "valid";
}

function wpStatusBadge(xpat: XpatWorkPermit | undefined) {
  if (!xpat) return null;
  if (isWpValid(xpat.isValid)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2.5 py-1 rounded-full">
        <ShieldCheck className="h-3.5 w-3.5" />
        {xpat.workPermitStateName ?? "Valid"}
      </span>
    );
  }
  if (isWpInvalid(xpat.isValid)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 px-2.5 py-1 rounded-full">
        <ShieldX className="h-3.5 w-3.5" />
        {xpat.workPermitStateName ?? "Invalid"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
      {xpat.workPermitStateName ?? "Unknown"}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b mb-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">{children}</div>;
}

function LoaSummarySection({ loa }: { loa: Loa }) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <SectionHeader title="Letter of Appointment" icon={FileText} />
        <InfoGrid>
          <Field label="Job Title" value={loa.jobTitle} />
          <Field label="Work Type" value={loa.workType} />
          <Field label="Work Site" value={loa.workSite} />
          <Field label="Basic Salary" value={loa.basicSalary} />
          <Field label="Contract Duration" value={loa.contractDuration} />
          <Field label="Commencement Date" value={loa.dateOfCommence} />
          <Field label="Working Hours" value={loa.workingHours} />
          <Field label="Signatory Name" value={loa.signatoryName} />
          <Field label="Signatory Designation" value={loa.signatoryDesignation} />
        </InfoGrid>
      </CardContent>
    </Card>
  );
}

function XpatSection({
  xpat,
  workPermitNumber,
  passportNumber,
}: {
  xpat: XpatWorkPermit;
  workPermitNumber: string;
  passportNumber: string;
}) {
  const cardSrc = `/api/xpat/card?workPermitNumber=${encodeURIComponent(workPermitNumber)}&passportNumber=${encodeURIComponent(passportNumber)}`;
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <SectionHeader title="Xpat / Immigration" icon={Globe} />
        <InfoGrid>
          <Field label="First Name" value={xpat.firstName} />
          <Field label="Middle Name" value={xpat.middleName} />
          <Field label="Last Name" value={xpat.lastName} />
          <Field label="Gender" value={xpat.gender} />
          <Field label="Date of Birth" value={formatXpatDate(xpat.dateOfBirth)} />
          <Field label="Nationality" value={xpat.nationality} />
          <Field label="ISO Country Code" value={xpat.isoAlpha3CountryCode} />
          <Field label="Contact Number" value={xpat.contactNumber} />
          <Field label="Occupation" value={xpat.occupationName} />
          <Field label="WP Status" value={xpat.workPermitStateName} />
          <Field label="WP Issued" value={formatXpatDate(xpat.workPermitIssuedDate)} />
          <Field label="WP Expiry" value={formatXpatDate(xpat.workPermitExpiry)} />
          <Field label="Employer" value={xpat.employerName} />
          <Field label="Employer Number" value={xpat.employerNumber} />
          <Field label="Employer Contact" value={xpat.employerContactNumber} />
        </InfoGrid>

        {xpat.verifyUrl && (
          <a
            href={xpat.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Verify on eGov Xpat MV
          </a>
        )}

        <div className="pt-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Work Permit Card</p>
          <img
            src={cardSrc}
            alt="Work Permit Card"
            className="rounded-xl border w-full max-w-md object-contain shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function EmployeeAvatar({
  passport,
  xpat,
  xpatLoading,
  hasXpat,
}: {
  passport: Passport;
  xpat?: XpatWorkPermit;
  xpatLoading: boolean;
  hasXpat: boolean;
}) {
  const initials = (passport.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const photoSrc = buildPhotoSrc(xpat?.photoUrl);

  const fallback = (
    <div className="h-28 w-28 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-4 border-background shadow-lg ring-1 ring-border">
      <span className="text-2xl font-bold text-primary">{initials}</span>
    </div>
  );

  if (!hasXpat) return fallback;
  if (xpatLoading) return <Skeleton className="h-28 w-28 rounded-full" />;
  if (!photoSrc) return fallback;

  return (
    <>
      <img
        src={photoSrc}
        alt={passport.fullName ?? "Employee"}
        className="h-28 w-28 rounded-full object-cover border-4 border-background shadow-lg ring-1 ring-border"
        onError={(e) => {
          const t = e.target as HTMLImageElement;
          t.style.display = "none";
          (t.nextElementSibling as HTMLElement | null)?.classList.remove("hidden");
        }}
      />
      <div className="h-28 w-28 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-4 border-background shadow-lg ring-1 ring-border hidden">
        <span className="text-2xl font-bold text-primary">{initials}</span>
      </div>
    </>
  );
}

// ─── Quick info pill ──────────────────────────────────────────────────────────

function InfoPill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const passportId = Number(params.id);

  const { data: passport, isLoading: passportLoading } = useGetPassport(passportId);
  const { data: loaEntries = [] } = useListLoa({ passportId });
  const latestLoa = loaEntries[0] ?? null;

  const wp = passport?.workPermitNumber ?? null;
  const pp = passport?.passportNumber ?? null;
  const hasXpat = !!(wp && pp);
  const xpatParams = { workPermitNumber: wp ?? "", passportNumber: pp ?? "" };

  const { data: xpat, isLoading: xpatLoading } = useGetXpatWorkPermit(xpatParams, {
    query: {
      enabled: hasXpat,
      staleTime: XPAT_15_MIN,
      queryKey: getGetXpatWorkPermitQueryKey(xpatParams),
    },
  });

  if (passportLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">
        Employee not found.
      </div>
    );
  }

  const status = passport.status ?? "processing";

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-4 py-2">
      {/* Back nav + actions row */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/master-list")} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Master List
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/master-list`)}
          className="gap-1.5"
        >
          <Edit className="h-3.5 w-3.5" />
          Edit Record
        </Button>
      </div>

      {/* ── Hero card ── */}
      <Card className="overflow-hidden">
        {/* Gradient top bar */}
        <div className="h-2 bg-gradient-to-r from-primary/80 via-primary to-primary/60" />
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <EmployeeAvatar
                passport={passport}
                xpat={xpat}
                xpatLoading={xpatLoading}
                hasXpat={hasXpat}
              />
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight uppercase truncate">
                  {passport.fullName || "—"}
                </h1>
                <p className="text-sm text-muted-foreground capitalize mt-0.5">
                  {passport.nationality || "Unknown nationality"} ·{" "}
                  <span className="font-mono text-xs">{passport.passportNumber || "No passport #"}</span>
                </p>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={status} />
                {xpat && wpStatusBadge(xpat)}
                {xpat?.workPermitExpiry && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
                    <Calendar className="h-3 w-3" />
                    Exp: {formatXpatDate(xpat.workPermitExpiry)}
                  </span>
                )}
              </div>

              {/* Quick info pills */}
              <div className="flex flex-wrap gap-2">
                {passport.companyName && <InfoPill icon={Briefcase} label={passport.companyName} />}
                {passport.clientName && <InfoPill icon={User} label={passport.clientName} />}
                {passport.workPermitNumber && <InfoPill icon={Hash} label={`WP: ${passport.workPermitNumber}`} />}
                {passport.agent && <InfoPill icon={Phone} label={`Agent: ${passport.agent}`} />}
              </div>
            </div>

            {/* Xpat verify button */}
            {xpat?.verifyUrl && (
              <div className="flex-shrink-0">
                <a href={xpat.verifyUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Verify on eGov
                  </Button>
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Passport & Record section ── */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <SectionHeader title="Passport & Record" icon={FileText} />
          <InfoGrid>
            <Field label="Full Name" value={passport.fullName} />
            <Field label="Passport Number" value={passport.passportNumber} mono />
            <Field label="Nationality" value={passport.nationality} />
            <Field label="Date of Birth" value={passport.dateOfBirth} />
            <Field label="Date of Issue" value={passport.dateOfIssue} />
            <Field label="Date of Expiry" value={passport.dateOfExpiry} />
            <Field label="Work Permit #" value={passport.workPermitNumber} mono />
            <Field label="Agent" value={passport.agent} />
            <Field label="Address" value={passport.address} />
            <Field label="Recruiting Company" value={passport.companyName} />
            <Field label="Allocated Client" value={passport.clientName} />
          </InfoGrid>
        </CardContent>
      </Card>

      {/* ── LOA Summary ── */}
      {latestLoa && <LoaSummarySection loa={latestLoa} />}

      {/* ── Xpat / Immigration ── */}
      {hasXpat ? (
        xpatLoading ? (
          <Card>
            <CardContent className="pt-5">
              <SectionHeader title="Xpat / Immigration" icon={Globe} />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : xpat ? (
          <XpatSection xpat={xpat} workPermitNumber={wp!} passportNumber={pp!} />
        ) : null
      ) : (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <SectionHeader title="Xpat / Immigration" icon={Globe} />
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-dashed">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">No immigration data</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add a Work Permit Number to this record to load live Xpat data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
