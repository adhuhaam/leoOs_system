import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetBillingDocument,
  useListCompanies,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";

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

export default function BillingPrintPage() {
  const [, params] = useRoute("/billing/:id/print");
  const id = params?.id ? Number(params.id) : 0;
  const { data: doc, isLoading } = useGetBillingDocument(id);
  const { data: companies = [] } = useListCompanies({ withBranding: true });
  const company = companies.find((c) => c.id === doc?.companyId);

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

  if (isLoading || !doc) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-96" />
      </div>
    );
  }

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
          <div className="grid grid-cols-2 gap-8 pb-6">
            {/* Left: doc title + balance due */}
            <div className="min-w-0">
              <h1 className="text-[26px] font-bold tracking-wide text-slate-900 uppercase leading-none">
                {isInvoice ? "TAX INVOICE" : "QUOTE"}
              </h1>
              <p className="text-[12px] text-slate-700 mt-3">
                {isInvoice ? "Invoice#" : "Quote#"}{" "}
                <span className="font-semibold text-slate-900">{doc.number}</span>
              </p>

              {isInvoice && (
                <div className="mt-6">
                  <p className="text-[11px] text-slate-600">Balance Due</p>
                  <p className="text-[22px] font-bold text-slate-900 leading-tight">
                    {formatMVR(grand)}
                  </p>
                </div>
              )}
            </div>

            {/* Right: company text block (mirrors Zoho-style header) */}
            <div className="text-right text-[11px] text-slate-700 leading-snug">
              <p className="font-bold text-[12.5px] text-slate-900 uppercase tracking-wide">
                {doc.companyName}
              </p>
              {company?.registrationNumber && (
                <p className="mt-1.5">{company.registrationNumber}</p>
              )}
              {company?.address && (
                <p className="whitespace-pre-line mt-0.5">{company.address}</p>
              )}
              {company?.phone && <p className="mt-0.5">{company.phone}</p>}
              {company?.email && <p className="mt-0.5">{company.email}</p>}
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
                  bold
                  className="pt-1"
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
          {!isInvoice && company?.signatoryName && (
            <div className="mt-10">
              {company.signatureImage && (
                <img
                  src={company.signatureImage}
                  alt="Signature"
                  className="max-h-16 object-contain mb-1"
                />
              )}
              <p className="font-semibold text-slate-900 text-[11.5px]">
                {company.signatoryName}
              </p>
              {company.signatoryDesignation && (
                <p className="text-slate-700 text-[10.5px]">
                  {company.signatoryDesignation}
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
  className = "",
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
  grand?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        grand ? "border-t border-b border-slate-300 py-2 my-1" : ""
      } ${className}`}
    >
      <span
        className={`${
          grand || bold ? "font-bold text-slate-900" : "text-slate-700"
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
          grand
            ? "text-[13px] font-bold text-slate-900"
            : bold
              ? "font-bold text-slate-900"
              : "font-medium text-slate-900"
        }`}
      >
        {grand || bold ? formatMVR(value) : fmt(value)}
      </span>
    </div>
  );
}
