import { useParams, useLocation } from "wouter";
import {
  useGetPassport,
  useListLoa,
  useGetXpatWorkPermit,
  getGetXpatWorkPermitQueryKey,
} from "@workspace/api-client-react";
import type { XpatWorkPermit, Loa } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, UserCircle2, ShieldCheck, ShieldX } from "lucide-react";

const XPAT_15_MIN = 15 * 60 * 1000;

function wpStatusBadge(xpat: XpatWorkPermit | undefined) {
  if (!xpat) return null;
  if (xpat.isValid === true) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-1 rounded">
        <ShieldCheck className="h-3.5 w-3.5" />
        {xpat.workPermitStateName ?? "Valid"}
      </span>
    );
  }
  if (xpat.isValid === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 px-2 py-1 rounded">
        <ShieldX className="h-3.5 w-3.5" />
        {xpat.workPermitStateName ?? "Invalid"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
      {xpat.workPermitStateName ?? "Unknown"}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground border-b pb-1 mb-4">
      {title}
    </p>
  );
}

function LoaSummarySection({ loa }: { loa: Loa }) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <SectionHeader title="Letter of Appointment" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Job Title" value={loa.jobTitle} />
          <Field label="Work Type" value={loa.workType} />
          <Field label="Work Site" value={loa.workSite} />
          <Field label="Basic Salary" value={loa.basicSalary} />
          <Field label="Contract Duration" value={loa.contractDuration} />
          <Field label="Commencement Date" value={loa.dateOfCommence} />
          <Field label="Working Hours" value={loa.workingHours} />
          <Field label="Signatory Name" value={loa.signatoryName} />
          <Field label="Signatory Designation" value={loa.signatoryDesignation} />
        </div>
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
        <SectionHeader title="Xpat / Immigration Information" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="First Name" value={xpat.firstName} />
          <Field label="Middle Name" value={xpat.middleName} />
          <Field label="Last Name" value={xpat.lastName} />
          <Field label="Gender" value={xpat.gender} />
          <Field label="Date of Birth" value={xpat.dateOfBirth} />
          <Field label="Nationality" value={xpat.nationality} />
          <Field label="ISO Country Code" value={xpat.isoAlpha3CountryCode} />
          <Field label="Contact Number" value={xpat.contactNumber} />
          <Field label="Occupation" value={xpat.occupationName} />
          <Field label="WP Status" value={xpat.workPermitStateName} />
          <Field label="WP Issued Date" value={xpat.workPermitIssuedDate} />
          <Field label="WP Expiry" value={xpat.workPermitExpiry} />
          <Field label="Employer Name" value={xpat.employerName} />
          <Field label="Employer Number" value={xpat.employerNumber} />
          <Field label="Employer Contact" value={xpat.employerContactNumber} />
        </div>
        {xpat.verifyUrl && (
          <a
            href={xpat.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on eGov Xpat MV
          </a>
        )}
        <div className="pt-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Work Permit Card</p>
          <img
            src={cardSrc}
            alt="Work Permit Card"
            className="rounded-lg border w-full max-w-md object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

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

  const photoSrc =
    xpat?.photoUrl
      ? `/api/xpat/photo?photoUrl=${encodeURIComponent(xpat.photoUrl)}`
      : null;

  if (passportLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">
        Candidate not found.
      </div>
    );
  }

  const initials = (passport.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/master-list")} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Master List
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt={passport.fullName ?? "Employee"}
                  className="h-28 w-28 rounded-full object-cover border-4 border-background shadow-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="h-28 w-28 rounded-full bg-muted flex items-center justify-center border-4 border-background shadow-md">
                  {xpatLoading && hasXpat ? (
                    <Skeleton className="h-full w-full rounded-full" />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
                  )}
                </div>
              )}
            </div>

            {/* Name + status */}
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl font-bold uppercase tracking-tight">
                {passport.fullName || "—"}
              </h1>
              <p className="text-sm text-muted-foreground capitalize">
                {passport.nationality || "Unknown nationality"}
              </p>
              {xpat && (
                <div className="flex flex-wrap gap-2 items-center pt-1">
                  {wpStatusBadge(xpat)}
                  {xpat.workPermitExpiry && (
                    <span className="text-xs text-muted-foreground">
                      Expires: <span className="font-medium text-foreground">{xpat.workPermitExpiry}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => navigate("/master-list")}>
                Edit Candidate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passport & Record section */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <SectionHeader title="Passport &amp; Record" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Full Name" value={passport.fullName} />
            <Field label="Passport Number" value={passport.passportNumber} />
            <Field label="Nationality" value={passport.nationality} />
            <Field label="Date of Birth" value={passport.dateOfBirth} />
            <Field label="Date of Issue" value={passport.dateOfIssue} />
            <Field label="Date of Expiry" value={passport.dateOfExpiry} />
            <Field label="Address" value={passport.address} />
            <Field label="Company" value={passport.companyName} />
            <Field label="Allocated Client" value={passport.clientName} />
            <Field label="Work Permit Number" value={passport.workPermitNumber} />
            <Field label="Agent" value={passport.agent} />
          </div>
        </CardContent>
      </Card>

      {/* LOA Summary */}
      {latestLoa && <LoaSummarySection loa={latestLoa} />}

      {/* Xpat / Immigration section */}
      {hasXpat && (
        xpatLoading ? (
          <Card>
            <CardContent className="pt-5">
              <SectionHeader title="Xpat / Immigration Information" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
      )}

      {!hasXpat && (
        <Card>
          <CardContent className="pt-5">
            <SectionHeader title="Xpat / Immigration Information" />
            <p className="text-sm text-muted-foreground">
              No work permit data available — set both the Passport Number and Work Permit Number to enable Xpat lookup.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
