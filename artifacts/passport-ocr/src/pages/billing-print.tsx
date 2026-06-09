import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PrintItem {
  id: number;
  description: string;
  detail: string | null;
  qty: string | number;
  rate: string | number;
  amount: string | number;
  position: number | null;
}

interface PrintDoc {
  id: number;
  kind: string;
  number: string;
  companyId: number;
  companyName: string;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyRegistrationNumber: string | null;
  companyBankName: string | null;
  companyBankAccountNumber: string | null;
  companyBankAccountHolder: string | null;
  companyBankSwiftCode: string | null;
  letterheadImage: string | null;
  signatoryName: string | null;
  signatoryDesignation: string | null;
  signatureImage: string | null;
  customerName: string;
  customerAddress: string | null;
  customerTin: string | null;
  issueDate: string | null;
  dueDate: string | null;
  terms: string | null;
  gstRate: string | number | null;
  gstInclusive: boolean | null;
  notes: string | null;
  status: string;
  items: PrintItem[];
  // System-level branding fallbacks
  systemLogoImage: string | null;
  systemAddress: string | null;
  systemPhone: string | null;
  systemEmail: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMVR(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "MVR 0.00";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "MVR 0.00";
  return `MVR ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillingPrintPage() {
  const [, params] = useRoute("/billing/:id/print");
  const id = params?.id ? Number(params.id) : 0;

  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || id <= 0) {
      setError("Invalid document ID");
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(`/api/billing/documents/${id}/print`)
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}: could not load document`);
        return r.json() as Promise<PrintDoc>;
      })
      .then((data) => {
        if (!cancelled) {
          setDoc(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document");
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Set the document title so "Save as PDF" suggests a sensible filename.
  useEffect(() => {
    if (!doc?.number) return undefined;
    const prev = document.title;
    document.title = doc.number;
    return () => {
      document.title = prev;
    };
  }, [doc?.number]);

  // Inject a print-only stylesheet so the toolbar disappears and the page
  // renders edge-to-edge when printing or saving as PDF.
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

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-slate-600">
        <p className="text-lg font-medium">Unable to load document</p>
        <p className="text-sm mt-1">{error ?? "Document not found"}</p>
      </div>
    );
  }

  // Resolved branding: per-company takes priority over system-level fallback
  const headerLogo = doc.letterheadImage ?? doc.systemLogoImage;
  const headerAddress = doc.companyAddress ?? doc.systemAddress;
  const headerPhone = doc.companyPhone ?? doc.systemPhone;
  const headerEmail = doc.companyEmail ?? doc.systemEmail;

  const isInvoice = doc.kind === "invoice";
  const subtotal = doc.items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const gstRate = Number(doc.gstRate || 0);
  const taxable = doc.gstInclusive
    ? subtotal / (1 + gstRate / 100)
    : subtotal;
  const gstAmount = doc.gstInclusive
    ? subtotal - taxable
    : (subtotal * gstRate) / 100;
  const grand = doc.gstInclusive ? subtotal : subtotal + gstAmount;
  const itemsTotal = doc.items.reduce((s, it) => s + Number(it.qty || 0), 0);

  return (
    <div className="print-outer bg-slate-100 min-h-screen py-6">
      {/* Toolbar — hidden on print */}
      <div className="no-print max-w-[820px] mx-auto px-4 mb-4 flex items-center justify-between">
        <Link href="/billing">
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

      {/* The printable document — A4-ish proportions */}
      <div className="print-shell max-w-[820px] mx-auto bg-white text-slate-900 shadow-lg">
        <div className="print-page p-12 text-[11.5px] leading-relaxed font-sans">
          {/* ===================== HEADER ===================== */}
          <div className="grid grid-cols-2 gap-8 pb-8">
            {/* Left: doc title + balance due */}
            <div className="min-w-0">
              <h1 className="text-[40px] font-light tracking-tight text-slate-900 uppercase leading-none">
                {isInvoice ? "TAX INVOICE" : "QUOTE"}
              </h1>
              <p className="text-[12px] text-slate-700 mt-3">
                {isInvoice ? "Invoice#" : "Quote#"}{" "}
                <span className="font-bold text-slate-900">{doc.number}</span>
              </p>

              {isInvoice && (
                <div className="mt-8">
                  <p className="text-[11.5px] text-slate-700">Balance Due</p>
                  <p className="text-[20px] font-bold text-slate-900 leading-tight mt-0.5">
                    {formatMVR(grand)}
                  </p>
                </div>
              )}
            </div>

            {/* Right: organization logo + company text block */}
            <div className="text-right text-[11px] text-slate-700 leading-snug">
              {headerLogo && (
                <img
                  src={headerLogo}
                  alt={doc.companyName}
                  className="ml-auto max-h-12 object-contain mb-2"
                />
              )}
              <p className="font-bold text-[12.5px] text-slate-900 uppercase tracking-wide">
                {doc.companyName}
              </p>
              {doc.companyRegistrationNumber && (
                <p className="mt-1.5">{doc.companyRegistrationNumber}</p>
              )}
              {headerEmail && <p className="mt-0.5">{headerEmail}</p>}
              {headerPhone && <p className="mt-0.5">{headerPhone}</p>}
              {headerAddress && (
                <p className="whitespace-pre-line mt-0.5">{headerAddress}</p>
              )}
            </div>
          </div>

          {/* ===================== DATES + BILL TO ===================== */}
          <div className="grid grid-cols-2 gap-8 pt-2 pb-6">
            <div className="space-y-2">
              <DateRow
                label={isInvoice ? "Invoice Date" : "Quote Date"}
                value={formatDate(doc.issueDate)}
              />
              {isInvoice && doc.terms && (
                <DateRow label="Terms" value={doc.terms} />
              )}
              {isInvoice && doc.dueDate && (
                <DateRow label="Due Date" value={formatDate(doc.dueDate)} />
              )}
            </div>
            <div>
              <p className="text-[11px] text-slate-600 font-medium mb-1">
                Bill To
              </p>
              <p className="font-bold text-slate-900 text-[12px]">
                {doc.customerName}
              </p>
              {doc.customerAddress && (
                <p className="whitespace-pre-line text-slate-700 mt-1 leading-relaxed">
                  {doc.customerAddress}
                </p>
              )}
              {doc.customerTin && (
                <p className="text-slate-700 mt-1">TIN: {doc.customerTin}</p>
              )}
            </div>
          </div>

          {/* ===================== ITEMS TABLE ===================== */}
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="text-left py-2.5 px-3 font-semibold w-8">#</th>
                <th className="text-left py-2.5 px-3 font-semibold">
                  Item &amp; Description
                </th>
                <th className="text-right py-2.5 px-3 font-semibold w-20">
                  Qty
                </th>
                <th className="text-right py-2.5 px-3 font-semibold w-24">
                  Rate
                </th>
                <th className="text-right py-2.5 px-3 font-semibold w-28">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => (
                <tr
                  key={it.id}
                  className="border-b border-slate-200 align-top"
                >
                  <td className="py-3 px-3 text-slate-700 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-900">
                      {it.description}
                    </p>
                    {it.detail && (
                      <p className="text-slate-600 mt-1 whitespace-pre-line text-[10.5px]">
                        {it.detail}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-800">
                    {fmt(Number(it.qty))}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-800">
                    {fmt(Number(it.rate), 4)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-medium text-slate-900">
                    {fmt(Number(it.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ===================== TOTALS ===================== */}
          <div className="grid grid-cols-2 gap-8 mt-3">
            <div className="text-[11px] text-slate-700 self-start pt-3">
              {isInvoice && (
                <p>
                  Items in Total{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    {fmt(itemsTotal)}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2 text-[11.5px] pt-3">
              <TotalRow
                label="Sub Total"
                value={subtotal}
                hint={doc.gstInclusive ? "(Tax Inclusive)" : undefined}
              />
              {gstRate > 0 && (
                <>
                  <TotalRow label="Total Taxable Amount" value={taxable} />
                  <TotalRow label={`GST (${gstRate}%)`} value={gstAmount} />
                </>
              )}
              <TotalRow label="Total" value={grand} grand />
              {isInvoice && (
                <TotalRow
                  label="Balance Due"
                  value={grand}
                  highlight
                />
              )}
            </div>
          </div>

          {/* ===================== NOTES ===================== */}
          {doc.notes && (
            <div className="mt-12 pt-4">
              <p className="text-[11px] text-slate-700 font-semibold mb-2">
                Notes
              </p>
              <p className="whitespace-pre-line text-slate-700 text-[11px] leading-relaxed">
                {doc.notes}
              </p>
            </div>
          )}

          {/* ===================== SIGNATORY (quotes only) ===================== */}
          {!isInvoice && doc.signatoryName && (
            <div className="mt-10">
              {doc.signatureImage && (
                <img
                  src={doc.signatureImage}
                  alt="Signature"
                  className="max-h-16 object-contain mb-1"
                />
              )}
              <p className="font-semibold text-slate-900 text-[11.5px]">
                {doc.signatoryName}
              </p>
              {doc.signatoryDesignation && (
                <p className="text-slate-700 text-[10.5px]">
                  {doc.signatoryDesignation}
                </p>
              )}
            </div>
          )}

          {isInvoice && !doc.notes && (
            <p className="mt-12 text-center text-[10px] text-slate-500 italic">
              This invoice is valid without a stamp or signature.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-[11.5px]">
      <span className="text-slate-700">{label} :</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  hint,
  bold,
  grand,
  highlight,
  className = "",
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
  grand?: boolean;
  highlight?: boolean;
  className?: string;
}) {
  const base = "flex items-baseline justify-between gap-4";
  const variant = grand
    ? "border-t border-slate-300 pt-3 mt-1"
    : highlight
      ? "bg-slate-100 px-3 py-2.5 mt-1"
      : "";
  return (
    <div className={`${base} ${variant} ${className}`}>
      <span
        className={`${
          grand || bold || highlight
            ? "font-bold text-slate-900"
            : "text-slate-700"
        } text-[11.5px]`}
      >
        {label}
        {hint && (
          <span className="text-slate-500 text-[10px] ml-1 font-normal">
            {hint}
          </span>
        )}
      </span>
      <span
        className={`tabular-nums ${
          grand || highlight
            ? "text-[12.5px] font-bold text-slate-900"
            : bold
              ? "font-bold text-slate-900"
              : "font-medium text-slate-900"
        }`}
      >
        {grand || bold || highlight ? formatMVR(value) : fmt(value)}
      </span>
    </div>
  );
}
