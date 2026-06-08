import { useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import {
  useListExpenses,
  useListExpenseCategories,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";
import { useSystemSettings } from "@/hooks/use-system-settings";

const ISSUER_NAME = "LEO EMPLOYMENT SERVICES PVT LTD";

function formatMVR(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "MVR 0.00";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "MVR 0.00";
  return `MVR ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ExpenseVoucherPrintPage() {
  const [, params] = useRoute("/expenses/:id/print");
  const id = params?.id ? Number(params.id) : 0;

  const { data: allExpenses = [], isLoading } = useListExpenses();
  const { data: categories = [] } = useListExpenseCategories();

  const expense = useMemo(
    () => (allExpenses as Array<{ id: number; categoryId: number; categoryName: string; amount: string | null; expenseDate: string | null; remarks: string | null }>).find((e) => e.id === id),
    [allExpenses, id],
  );

  const {
    logoImage: systemLogo,
    companyAddress: systemAddress,
    companyPhone: systemPhone,
    companyEmail: systemEmail,
  } = useSystemSettings();

  const categoryColor = useMemo(() => {
    if (!expense) return null;
    return (categories as Array<{ id: number; name: string; color: string | null }>).find(
      (c) => c.id === expense.categoryId,
    );
  }, [categories, expense]);

  useEffect(() => {
    if (!expense) return;
    const prev = document.title;
    document.title = `EXP-${String(expense.id).padStart(5, "0")}`;
    return () => {
      document.title = prev;
    };
  }, [expense]);

  useEffect(() => {
    const css = `
      @page { size: A5; margin: 10mm; }
      @media print {
        html, body { background: white !important; }
        .no-print { display: none !important; }
        .print-root {
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
        }
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Skeleton className="h-[540px] w-[420px] rounded-2xl" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Expense not found.</p>
        <Link href="/billing">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Billing
          </Button>
        </Link>
      </div>
    );
  }

  const voucherNo = `EXP-${String(expense.id).padStart(5, "0")}`;
  const _ = categoryColor;

  return (
    <div className="min-h-screen bg-gray-100 print-root">
      {/* Toolbar */}
      <div className="no-print flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
        <Link href="/billing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Billing
          </Button>
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Voucher card */}
      <div className="max-w-[480px] mx-auto my-8 bg-white rounded-2xl shadow-xl border border-border/40 overflow-hidden print-root">

        {/* Header band */}
        <div className="bg-slate-900 px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {systemLogo ? (
                <img
                  src={systemLogo}
                  alt="Company logo"
                  className="h-10 object-contain mb-2"
                />
              ) : (
                <p className="text-white font-bold text-base tracking-wide">
                  {ISSUER_NAME}
                </p>
              )}
              {systemAddress && (
                <p className="text-slate-400 text-[11px] mt-1 whitespace-pre-line leading-relaxed">
                  {systemAddress}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-amber-400 text-[10px] font-semibold uppercase tracking-[0.18em]">
                Expense Voucher
              </p>
              <p className="text-white font-mono font-bold text-2xl mt-1">{voucherNo}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">
          {/* Key fields */}
          <div className="grid grid-cols-2 gap-5">
            <VoucherField label="Date" value={formatDate(expense.expenseDate)} />
            <VoucherField label="Category" value={expense.categoryName} />
          </div>

          {/* Amount */}
          <div className="border-t border-dashed border-border pt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Amount
              </span>
              <span className="text-3xl font-bold tabular-nums tracking-tight">
                {formatMVR(expense.amount)}
              </span>
            </div>
          </div>

          {/* Remarks */}
          {expense.remarks && (
            <div className="border-t border-border/60 pt-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
                Remarks
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {expense.remarks}
              </p>
            </div>
          )}
        </div>

        {/* Footer — signature blocks */}
        <div className="border-t border-border/60 px-8 py-5 bg-slate-50">
          <div className="flex items-end justify-between gap-6">
            <SigBlock label="Prepared by" />
            <SigBlock label="Approved by" />
            {(systemPhone || systemEmail) && (
              <div className="text-right text-[10px] text-muted-foreground leading-5">
                {systemPhone && <p>{systemPhone}</p>}
                {systemEmail && <p>{systemEmail}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VoucherField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground">{value || "—"}</p>
    </div>
  );
}

function SigBlock({ label }: { label: string }) {
  return (
    <div className="flex-1 max-w-[130px]">
      <div className="h-8" />
      <div className="border-t border-foreground/25 pt-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
