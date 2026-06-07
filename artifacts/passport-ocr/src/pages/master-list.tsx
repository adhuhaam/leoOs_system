import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useListPassports,
  useListLoa,
  useListCompanies,
  useListClients,
  useListLoaOptions,
  useDeletePassport,
  useUpdatePassport,
  useUpdateLoa,
  useGetXpatWorkPermit,
  getGetXpatWorkPermitQueryKey,
  getListPassportsQueryKey,
  getGetPassportStatsQueryKey,
  getListLoaQueryKey,
} from "@workspace/api-client-react";
import type { Passport, XpatWorkPermit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Filter, Loader2, Users, X, Eye, Pencil,
  ShieldCheck, ShieldX, ExternalLink,
} from "lucide-react";

const XPAT_STALE = 15 * 60 * 1000;

/**
 * Parse the photoId and serviceId from the Xpat photoUrl field.
 * The field looks like "/WorkPermit/GetImage?photoId=xxx&serviceId=yyy".
 * We extract the IDs and pass them to our own proxy — never the raw URL —
 * so the backend always constructs the target URL itself (no SSRF risk).
 */
function parseXpatPhotoParams(photoUrl: string | null | undefined): { photoId: string; serviceId: string } | null {
  if (!photoUrl) return null;
  try {
    const url = new URL(photoUrl, "https://mobile-xpat.egov.mv");
    const photoId = url.searchParams.get("photoId");
    const serviceId = url.searchParams.get("serviceId");
    if (!photoId || !serviceId) return null;
    return { photoId, serviceId };
  } catch {
    return null;
  }
}

function buildPhotoSrc(photoUrl: string | null | undefined): string | null {
  const p = parseXpatPhotoParams(photoUrl);
  if (!p) return null;
  return `/api/xpat/photo?photoId=${encodeURIComponent(p.photoId)}&serviceId=${encodeURIComponent(p.serviceId)}`;
}

function formatXpatDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Maps stored demonyms (e.g. "bangladeshi") to the canonical country key.
const DEMONYM_MAP: Record<string, string> = {
  bangladeshi: "bangladesh",
  indian: "india",
  nepali: "nepal",
  nepalese: "nepal",
  maldivian: "maldives",
  pakistani: "pakistan",
  "sri lankan": "sri lanka",
  srilankan: "sri lanka",
};

function normalizeNationality(raw: string | null | undefined): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  return DEMONYM_MAP[lower] ?? lower;
}

type StatusFilter = "all" | "completed" | "processing" | "failed";
type NationalityFilter = "all" | "bangladesh" | "india" | "nepal";
type AllocationFilter = string;

interface Row {
  passport: Passport;
  companyId: number | null;
  companyName: string | null;
  loaCount: number;
}

function WpStatusBadge({ xpat }: { xpat: XpatWorkPermit }) {
  if (xpat.isValid === true) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-1.5 py-0.5 rounded whitespace-nowrap">
        <ShieldCheck className="h-3 w-3" />
        {xpat.workPermitStateName ?? "Valid"}
      </span>
    );
  }
  if (xpat.isValid === false) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded whitespace-nowrap">
        <ShieldX className="h-3 w-3" />
        {xpat.workPermitStateName ?? "Invalid"}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
      {xpat.workPermitStateName ?? "Unknown"}
    </span>
  );
}

/** A single table row that fetches its own Xpat data lazily. */
function PassportRow({
  row,
  onEdit,
}: {
  row: Row;
  onEdit: () => void;
}) {
  const { passport, companyName, loaCount } = row;
  const [, navigate] = useLocation();

  const wp = passport.workPermitNumber ?? null;
  const pp = passport.passportNumber ?? null;
  const hasXpat = !!(wp && pp);

  const xpatParams = { workPermitNumber: wp ?? "", passportNumber: pp ?? "" };
  const { data: xpat, isLoading: xpatLoading } = useGetXpatWorkPermit(xpatParams, {
    query: {
      enabled: hasXpat,
      staleTime: XPAT_STALE,
      queryKey: getGetXpatWorkPermitQueryKey(xpatParams),
    },
  });

  const photoSrc = buildPhotoSrc(xpat?.photoUrl);

  const initials = (passport.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <TableRow data-testid={`row-master-${passport.id}`}>
      {/* Photo */}
      <TableCell className="w-12 pr-2">
        {hasXpat && xpatLoading ? (
          <Skeleton className="h-9 w-9 rounded-full" />
        ) : photoSrc ? (
          <img
            src={photoSrc}
            alt={passport.fullName ?? ""}
            className="h-9 w-9 rounded-full object-cover border"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-muted border flex items-center justify-center">
            <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
          </div>
        )}
        {/* Fallback shown by onError above */}
        {photoSrc && (
          <div className="h-9 w-9 rounded-full bg-muted border flex items-center justify-center hidden">
            <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
          </div>
        )}
      </TableCell>

      {/* Name / Passport # */}
      <TableCell>
        <p className="font-medium uppercase text-sm leading-tight">{passport.fullName || "—"}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{passport.passportNumber || "—"}</p>
        {wp && <p className="font-mono text-[10px] text-muted-foreground/70">{wp}</p>}
      </TableCell>

      {/* Company / Client */}
      <TableCell className="hidden md:table-cell">
        <p className="text-sm truncate max-w-[140px]">{companyName || <span className="text-muted-foreground italic text-xs">No company</span>}</p>
        {passport.clientName ? (
          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{passport.clientName}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Unallocated</p>
        )}
      </TableCell>

      {/* Xpat: Status + Expiry */}
      <TableCell className="hidden lg:table-cell">
        {hasXpat && xpatLoading ? (
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : xpat ? (
          <div className="space-y-1">
            <WpStatusBadge xpat={xpat} />
            {xpat.workPermitExpiry && (
              <p className="text-[10px] text-muted-foreground">
                Exp: {formatXpatDate(xpat.workPermitExpiry)}
              </p>
            )}
          </div>
        ) : hasXpat ? (
          <span className="text-[10px] text-muted-foreground">—</span>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">No WP data</span>
        )}
      </TableCell>

      {/* OCR Status */}
      <TableCell>
        {passport.status === "completed" && (
          <span className="text-[10px] font-semibold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-1 rounded">
            DONE
          </span>
        )}
        {passport.status === "processing" && (
          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-1 rounded">
            OCR
          </span>
        )}
        {passport.status === "failed" && (
          <span className="text-[10px] font-semibold text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 px-2 py-1 rounded">
            FAIL
          </span>
        )}
      </TableCell>

      {/* Actions: View + Edit */}
      <TableCell>
        <div className="flex gap-1.5 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => navigate(`/employees/${passport.id}`)}
            data-testid={`button-view-master-${passport.id}`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">View</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={onEdit}
            data-testid={`button-edit-master-${passport.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function MasterListPage() {
  const [search, setSearch] = useState("");
  const [nationalityFilter, setNationalityFilter] = useState<NationalityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [allocationFilter, setAllocationFilter] = useState<AllocationFilter>("all");

  const [editPassport, setEditPassport] = useState<Passport | null>(null);
  const [deletePassportId, setDeletePassportId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const passportParams = {
    ...(search ? { search } : {}),
    ...(nationalityFilter !== "all" ? { nationality: nationalityFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(allocationFilter.startsWith("client:")
      ? { clientId: allocationFilter.slice("client:".length) }
      : allocationFilter === "unallocated"
        ? { clientId: "none" }
        : allocationFilter.startsWith("company:")
          ? { companyId: allocationFilter.slice("company:".length) }
          : allocationFilter === "no-loa"
            ? { companyId: "none" }
            : {}),
  };
  const { data: passports = [], isLoading } = useListPassports(passportParams, {
    query: { queryKey: getListPassportsQueryKey(passportParams) },
  });
  const { data: loas = [] } = useListLoa();
  const { data: companies = [] } = useListCompanies();
  const { data: clients = [] } = useListClients();

  const latestLoaByPassport = useMemo(() => {
    const m = new Map<number, { companyId: number | null; companyName: string | null; count: number }>();
    for (const loa of loas) {
      if (loa.passportId == null) continue;
      const existing = m.get(loa.passportId);
      if (existing) {
        existing.count += 1;
      } else {
        m.set(loa.passportId, {
          companyId: loa.companyId ?? null,
          companyName: loa.companyName ?? null,
          count: 1,
        });
      }
    }
    return m;
  }, [loas]);

  const rows: Row[] = useMemo(() => {
    return passports.map((p) => {
      const link = latestLoaByPassport.get(p.id);
      return {
        passport: p,
        companyId: p.companyId ?? null,
        companyName: p.companyName ?? null,
        loaCount: link?.count ?? 0,
      };
    });
  }, [passports, latestLoaByPassport]);

  const filteredRows = useMemo(() => rows, [rows]);

  const activeFilterCount =
    (search ? 1 : 0) +
    (nationalityFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (allocationFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setNationalityFilter("all");
    setStatusFilter("all");
    setAllocationFilter("all");
  };

  const deleteMutation = useDeletePassport();

  const handleDelete = () => {
    if (!deletePassportId) return;
    deleteMutation.mutate(
      { id: deletePassportId },
      {
        onSuccess: () => {
          toast({ title: "Candidate deleted" });
          queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPassportStatsQueryKey() });
          setDeletePassportId(null);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Master List &amp; Records
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every candidate in the system — passport details, allocation, work permit, agent. Search, filter, edit, or remove.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Showing <strong className="text-foreground">{filteredRows.length}</strong> of{" "}
            <strong className="text-foreground">{passports.length}</strong>
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center md:justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or passport number..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-master"
                />
              </div>
              <div className="grid grid-cols-2 md:flex gap-2">
                <Select value={allocationFilter} onValueChange={setAllocationFilter}>
                  <SelectTrigger className="md:w-[220px]" data-testid="select-allocation-filter">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Allocation / Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All allocations</SelectItem>
                    <SelectItem value="unallocated">— Unallocated —</SelectItem>
                    {clients.length > 0 && (
                      <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Clients (allocation)
                      </div>
                    )}
                    {clients.map((c) => (
                      <SelectItem key={`client-${c.id}`} value={`client:${c.id}`}>
                        {c.name}
                      </SelectItem>
                    ))}
                    {companies.length > 0 && (
                      <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Companies
                      </div>
                    )}
                    <SelectItem value="no-loa">— No company assigned —</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={`company-${c.id}`} value={`company:${c.id}`}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={nationalityFilter} onValueChange={(v) => setNationalityFilter(v as NationalityFilter)}>
                  <SelectTrigger className="md:w-[160px]" data-testid="select-nationality-filter">
                    <SelectValue placeholder="Nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Nationalities</SelectItem>
                    <SelectItem value="bangladesh">Bangladesh</SelectItem>
                    <SelectItem value="india">India</SelectItem>
                    <SelectItem value="nepal">Nepal</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="md:w-[140px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="md:w-auto"
                    data-testid="button-clear-filters"
                  >
                    <X className="w-4 h-4 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="hidden md:table-cell">Company / Client</TableHead>
                  <TableHead className="hidden lg:table-cell">WP Status</TableHead>
                  <TableHead>OCR</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {passports.length === 0
                        ? "No candidates yet — upload a passport from the Process Document page."
                        : "No candidates match your filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <PassportRow
                      key={row.passport.id}
                      row={row}
                      onEdit={() => setEditPassport(row.passport)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editPassport && (
        <EditCandidateDialog
          passport={editPassport}
          open={!!editPassport}
          onOpenChange={(o) => !o && setEditPassport(null)}
        />
      )}

      <AlertDialog open={!!deletePassportId} onOpenChange={(o) => !o && setDeletePassportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the candidate's passport record. Any Letters of Appointment
              already generated for them keep their snapshot of the details and are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-master"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditCandidateDialog({
  passport,
  open,
  onOpenChange,
}: {
  passport: Passport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdatePassport();
  const updateLoaMutation = useUpdateLoa();
  const { data: clients = [] } = useListClients();
  const { data: companies = [] } = useListCompanies();

  const { data: loaEntries = [] } = useListLoa({ passportId: passport.id });
  const existingLoa = loaEntries[0] ?? null;

  const wp = passport.workPermitNumber ?? null;
  const pp = passport.passportNumber ?? null;
  const hasXpat = !!(wp && pp);

  const xpatParams2 = { workPermitNumber: wp ?? "", passportNumber: pp ?? "" };
  const { data: xpat, isLoading: xpatLoading } = useGetXpatWorkPermit(xpatParams2, {
    query: {
      enabled: hasXpat,
      staleTime: XPAT_STALE,
      queryKey: getGetXpatWorkPermitQueryKey(xpatParams2),
    },
  });

  const photoSrc = buildPhotoSrc(xpat?.photoUrl);

  const cardSrc =
    hasXpat && wp && pp
      ? `/api/xpat/card?workPermitNumber=${encodeURIComponent(wp)}&passportNumber=${encodeURIComponent(pp)}`
      : null;

  const [form, setForm] = useState({
    fullName: passport.fullName || "",
    passportNumber: passport.passportNumber || "",
    nationality: normalizeNationality(passport.nationality),
    dateOfBirth: passport.dateOfBirth || "",
    dateOfIssue: passport.dateOfIssue || "",
    dateOfExpiry: passport.dateOfExpiry || "",
    address: passport.address || "",
    companyId: passport.companyId != null ? String(passport.companyId) : "",
    clientId: passport.clientId != null ? String(passport.clientId) : "",
    workPermitNumber: passport.workPermitNumber || "",
    agent: passport.agent || "",
    jobTitle: "",
    workType: "",
    workSite: "",
  });

  useEffect(() => {
    if (existingLoa) {
      setForm((prev) => ({
        ...prev,
        jobTitle: existingLoa.jobTitle ?? "",
        workType: existingLoa.workType ?? "",
        workSite: existingLoa.workSite ?? "",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingLoa?.id]);

  const selectedCompanyId = form.companyId ? Number(form.companyId) : undefined;
  const { data: loaOptions = [] } = useListLoaOptions({ companyId: selectedCompanyId ?? 0 });
  const jobTitleOpts = loaOptions.filter((o) => o.category === "job_title").map((o) => o.value);
  const workTypeOpts = loaOptions.filter((o) => o.category === "work_type").map((o) => o.value);
  const workSiteOpts = loaOptions.filter((o) => o.category === "work_site").map((o) => o.value);

  const isPending = updateMutation.isPending || updateLoaMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { companyId, clientId, jobTitle, workType, workSite, workPermitNumber, agent, ...rest } = form;

    updateMutation.mutate(
      {
        id: passport.id,
        data: {
          ...rest,
          companyId: companyId === "" ? null : Number(companyId),
          clientId: clientId === "" ? null : Number(clientId),
          workPermitNumber: workPermitNumber.trim() || null,
          agent: agent.trim() || null,
        },
      },
      {
        onSuccess: () => {
          const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() });
            toast({ title: "Candidate updated" });
            onOpenChange(false);
          };
          if (existingLoa) {
            updateLoaMutation.mutate(
              {
                id: existingLoa.id,
                data: {
                  jobTitle: jobTitle.trim() || undefined,
                  workType: workType.trim() || undefined,
                  workSite: workSite.trim() || undefined,
                },
              },
              { onSuccess: invalidate, onError: () => toast({ title: "LOA fields failed to save", variant: "destructive" }) },
            );
          } else {
            invalidate();
          }
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      },
    );
  };

  const initials = (passport.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Candidate</DialogTitle>
          <DialogDescription>Update passport details, company, employment terms, and allocation.</DialogDescription>
        </DialogHeader>

        {/* Xpat photo + status banner */}
        {hasXpat && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
            {xpatLoading ? (
              <>
                <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </>
            ) : (
              <>
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt={passport.fullName ?? ""}
                    className="h-14 w-14 rounded-full object-cover border-2 border-background shadow flex-shrink-0"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-background border-2 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-muted-foreground">{initials}</span>
                  </div>
                )}
                <div className="flex-1 space-y-1 min-w-0">
                  {xpat ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        {xpat.isValid === true && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded">
                            <ShieldCheck className="h-3 w-3" /> {xpat.workPermitStateName ?? "Valid"}
                          </span>
                        )}
                        {xpat.isValid === false && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded">
                            <ShieldX className="h-3 w-3" /> {xpat.workPermitStateName ?? "Invalid"}
                          </span>
                        )}
                        {xpat.isValid == null && xpat.workPermitStateName && (
                          <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {xpat.workPermitStateName}
                          </span>
                        )}
                        {xpat.workPermitExpiry && (
                          <span className="text-[11px] text-muted-foreground">
                            Expires: <span className="font-medium text-foreground">{formatXpatDate(xpat.workPermitExpiry)}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {xpat.occupationName ?? "—"} · {xpat.employerName ?? "—"}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No Xpat data available</p>
                  )}
                </div>
                {xpat?.verifyUrl && (
                  <a href={xpat.verifyUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Passport details */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Passport</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="uppercase font-mono"
                  data-testid="input-edit-fullname"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Passport Number</Label>
                <Input
                  value={form.passportNumber}
                  onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
                  className="uppercase font-mono"
                  data-testid="input-edit-passport-number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nationality</Label>
                <Select value={form.nationality} onValueChange={(v) => setForm({ ...form, nationality: v })}>
                  <SelectTrigger data-testid="select-edit-nationality">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bangladesh">Bangladesh</SelectItem>
                    <SelectItem value="india">India</SelectItem>
                    <SelectItem value="nepal">Nepal</SelectItem>
                    <SelectItem value="maldives">Maldives</SelectItem>
                    <SelectItem value="pakistan">Pakistan</SelectItem>
                    <SelectItem value="sri lanka">Sri Lanka</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} placeholder="YYYY-MM-DD or DD/MM/YYYY" data-testid="input-edit-dob" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Issue</Label>
                <Input value={form.dateOfIssue} onChange={(e) => setForm({ ...form, dateOfIssue: e.target.value })} placeholder="YYYY-MM-DD or DD/MM/YYYY" data-testid="input-edit-issue" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Expiry</Label>
                <Input value={form.dateOfExpiry} onChange={(e) => setForm({ ...form, dateOfExpiry: e.target.value })} placeholder="YYYY-MM-DD or DD/MM/YYYY" data-testid="input-edit-expiry" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="input-edit-address" />
              </div>
            </div>
          </div>

          {/* Company & employment */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Company &amp; Employment</p>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={form.companyId === "" ? "__none__" : form.companyId}
                onValueChange={(v) => setForm({ ...form, companyId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger data-testid="select-edit-company">
                  <SelectValue placeholder="Select recruiting company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {existingLoa && (
              <div className="grid grid-cols-2 gap-4 pt-1">
                <EmploymentField
                  label="Job Title"
                  value={form.jobTitle}
                  onChange={(v) => setForm({ ...form, jobTitle: v })}
                  options={jobTitleOpts}
                  testId="edit-job-title"
                />
                <EmploymentField
                  label="Work Type"
                  value={form.workType}
                  onChange={(v) => setForm({ ...form, workType: v })}
                  options={workTypeOpts}
                  testId="edit-work-type"
                />
                <EmploymentField
                  label="Work Site"
                  value={form.workSite}
                  onChange={(v) => setForm({ ...form, workSite: v })}
                  options={workSiteOpts}
                  testId="edit-work-site"
                  className="col-span-2"
                />
              </div>
            )}
            {!existingLoa && (
              <p className="text-[11px] text-muted-foreground">No LOA exists for this candidate yet — employment terms are set when the LOA is created.</p>
            )}
          </div>

          {/* Allocation */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Allocation</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Allocated Client</Label>
                <Select
                  value={form.clientId === "" ? "__none__" : form.clientId}
                  onValueChange={(v) => setForm({ ...form, clientId: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger data-testid="select-edit-client">
                    <SelectValue placeholder="Where is this candidate allocated?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Unallocated —</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clients.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No clients yet — add one from the Clients page first.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Work Permit Number</Label>
                <Input value={form.workPermitNumber} onChange={(e) => setForm({ ...form, workPermitNumber: e.target.value })} className="font-mono" data-testid="input-edit-work-permit" />
              </div>
              <div className="space-y-1.5">
                <Label>Agent</Label>
                <Input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} data-testid="input-edit-agent" />
              </div>
            </div>
          </div>

          {/* Xpat / Immigration panel */}
          {hasXpat && xpat && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Xpat / Immigration Information</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ["First Name", xpat.firstName],
                  ["Middle Name", xpat.middleName],
                  ["Last Name", xpat.lastName],
                  ["Gender", xpat.gender],
                  ["Date of Birth", xpat.dateOfBirth],
                  ["Nationality", xpat.nationality],
                  ["ISO Code", xpat.isoAlpha3CountryCode],
                  ["Contact", xpat.contactNumber],
                  ["Occupation", xpat.occupationName],
                  ["WP Status", xpat.workPermitStateName],
                  ["WP Issued", xpat.workPermitIssuedDate],
                  ["WP Expiry", xpat.workPermitExpiry],
                  ["Employer", xpat.employerName],
                  ["Employer #", xpat.employerNumber],
                  ["Employer Contact", xpat.employerContactNumber],
                ].map(([label, value]) => (
                  <div key={String(label)} className="space-y-0.5">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="font-medium">{value || <span className="text-muted-foreground">—</span>}</p>
                  </div>
                ))}
              </div>
              {xpat.verifyUrl && (
                <a
                  href={xpat.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on eGov Xpat MV
                </a>
              )}
              {cardSrc && (
                <div className="pt-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Work Permit Card</p>
                  <img
                    src={cardSrc}
                    alt="Work Permit Card"
                    className="rounded border w-full max-w-sm object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-candidate">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A Select + optional free-text Input for an employment field.
 */
function EmploymentField({
  label,
  value,
  onChange,
  options,
  testId,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId: string;
  className?: string;
}) {
  const isCustom = value !== "" && !options.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  if (options.length === 0) {
    return (
      <div className={`space-y-1.5 ${className ?? ""}`}>
        <Label>{label}</Label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`} data-testid={`input-${testId}`} />
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Select
        value={showCustom ? "__custom__" : value || "__none__"}
        onValueChange={(v) => {
          if (v === "__none__") { setShowCustom(false); onChange(""); }
          else if (v === "__custom__") { setShowCustom(true); onChange(value); }
          else { setShowCustom(false); onChange(v); }
        }}
      >
        <SelectTrigger data-testid={`select-${testId}`}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          {isCustom && !showCustom && <SelectItem value={value}>{value}</SelectItem>}
          <SelectItem value="__custom__">— Custom… —</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter custom ${label.toLowerCase()}`}
          autoFocus
          data-testid={`input-${testId}-custom`}
        />
      )}
    </div>
  );
}
