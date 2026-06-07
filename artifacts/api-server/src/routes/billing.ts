import { Router, type IRouter } from "express";
import { eq, desc, and, sql, type SQL } from "drizzle-orm";
import {
  db,
  billingDocumentsTable,
  billingItemsTable,
  companiesTable,
  clientsTable,
} from "@workspace/db";
import {
  CreateBillingDocumentBody,
  UpdateBillingDocumentParams,
  UpdateBillingDocumentBody,
  DeleteBillingDocumentParams,
  GetBillingDocumentParams,
  ListBillingDocumentsQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "./auth";

const router: IRouter = Router();

// Money column precision must match the DB schema in lib/db/src/schema/billing.ts:
//  - amount       numeric(14,2) → 12 integer digits, 2 decimals
//  - qty / rate   numeric(14,4) → 10 integer digits, 4 decimals
//  - gst_rate     numeric(5,2)  → 3 integer digits,  2 decimals (max 999.99)
// Pass `maxIntegerDigits` so over-large numbers fail with a 400 instead of a 500
// at insert time.
function normalizeMoney(
  input: string | number | null | undefined,
  scale: 2 | 4 = 2,
  maxIntegerDigits = 12,
): string | null {
  if (input == null) return null;
  const s = String(input).replace(/,/g, "").trim();
  if (!s) return null;
  const re = scale === 4 ? /^(\d+)(?:\.(\d{1,4}))?$/ : /^(\d+)(?:\.(\d{1,2}))?$/;
  const m = re.exec(s);
  if (!m) return null;
  const intPart = m[1].replace(/^0+(?=\d)/, "");
  if ((intPart || "0").length > maxIntegerDigits) return null;
  const num = Number(s);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(scale);
}

function normalizeDate(input: string | null | undefined): string | null | "invalid" {
  if (input == null) return null;
  const t = input.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return "invalid";
  const [, ys, ms, ds] = m;
  const y = Number(ys), mo = Number(ms), d = Number(ds);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return "invalid";
  }
  return t;
}

function pad(n: number, width = 6): string {
  return String(n).padStart(width, "0");
}

// All invoices and quotations are issued by LEO Employment Services. Resolve
// (or auto-create) the matching companies row so the user never has to seed it
// manually — works the same in dev and production.
const ISSUER_NAME = "LEO EMPLOYMENT SERVICES PVT LTD";
const ISSUER_REG_NUMBER = "C20542025";
async function getOrCreateIssuerId(tx: Tx): Promise<number> {
  const existing = await tx
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(sql`LOWER(${companiesTable.name}) = LOWER(${ISSUER_NAME})`)
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const inserted = await tx
    .insert(companiesTable)
    .values({ name: ISSUER_NAME, registrationNumber: ISSUER_REG_NUMBER })
    .returning({ id: companiesTable.id });
  return inserted[0].id;
}

// Allocate the next number for a kind. Looks at the max existing number with
// the matching prefix and increments. Concurrency note: we run this inside the
// same transaction as the insert so a unique-index violation will roll back.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function allocateNumber(kind: "invoice" | "quotation", tx: Tx): Promise<string> {
  const prefix = kind === "invoice" ? "INV-" : "QT-";
  const rows = await tx
    .select({ number: billingDocumentsTable.number })
    .from(billingDocumentsTable)
    .where(eq(billingDocumentsTable.kind, kind));
  let max = 0;
  for (const r of rows) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(r.number);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return `${prefix}${pad(max + 1)}`;
}

router.get("/billing/documents", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListBillingDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { kind, search, clientId } = parsed.data;
  const conds: SQL[] = [];
  if (kind) conds.push(eq(billingDocumentsTable.kind, kind));
  if (clientId != null) conds.push(eq(billingDocumentsTable.clientId, clientId));

  // Role-scoped filtering — explicit allowlist, hard-deny on missing linkage
  const sessionRole = req.session?.role;
  const linkedEntityId = req.session?.linkedEntityId;
  if (sessionRole === "superuser" || sessionRole === "admin") {
    // unrestricted list
  } else if (sessionRole === "company") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    conds.push(eq(billingDocumentsTable.companyId, eid));
  } else if (sessionRole === "client") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked client on session" });
      return;
    }
    conds.push(eq(billingDocumentsTable.clientId, eid));
  } else if (sessionRole === "employee" || sessionRole === "agent") {
    // employee/agent have no billing access (no billing tab in UI)
    res.status(403).json({ error: "Access denied" });
    return;
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: billingDocumentsTable.id,
      kind: billingDocumentsTable.kind,
      number: billingDocumentsTable.number,
      companyId: billingDocumentsTable.companyId,
      companyName: companiesTable.name,
      clientId: billingDocumentsTable.clientId,
      customerName: billingDocumentsTable.customerName,
      customerAddress: billingDocumentsTable.customerAddress,
      customerTin: billingDocumentsTable.customerTin,
      issueDate: billingDocumentsTable.issueDate,
      dueDate: billingDocumentsTable.dueDate,
      terms: billingDocumentsTable.terms,
      gstRate: billingDocumentsTable.gstRate,
      gstInclusive: billingDocumentsTable.gstInclusive,
      notes: billingDocumentsTable.notes,
      status: billingDocumentsTable.status,
      createdAt: billingDocumentsTable.createdAt,
      updatedAt: billingDocumentsTable.updatedAt,
    })
    .from(billingDocumentsTable)
    .innerJoin(companiesTable, eq(billingDocumentsTable.companyId, companiesTable.id))
    .where(where)
    .orderBy(desc(billingDocumentsTable.createdAt));

  // Compute totals per row from item amounts so the listing can show them
  // without N+1 round-trips. One join is fine for small volumes.
  const totalsMap = new Map<number, string>();
  if (rows.length > 0) {
    const totalsRows = await db
      .select({
        documentId: billingItemsTable.documentId,
        total: sql<string>`COALESCE(SUM(${billingItemsTable.amount}), 0)::text`,
      })
      .from(billingItemsTable)
      .groupBy(billingItemsTable.documentId);
    for (const t of totalsRows) totalsMap.set(t.documentId, t.total);
  }

  const result = rows.map((r) => ({
    ...r,
    subtotal: totalsMap.get(r.id) ?? "0",
  }));

  const filtered = search
    ? result.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.number.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q)
        );
      })
    : result;
  res.json(filtered);
});

router.get("/billing/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetBillingDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { id } = parsed.data;
  const docRows = await db
    .select({
      id: billingDocumentsTable.id,
      kind: billingDocumentsTable.kind,
      number: billingDocumentsTable.number,
      companyId: billingDocumentsTable.companyId,
      clientId: billingDocumentsTable.clientId,
      companyName: companiesTable.name,
      customerName: billingDocumentsTable.customerName,
      customerAddress: billingDocumentsTable.customerAddress,
      customerTin: billingDocumentsTable.customerTin,
      issueDate: billingDocumentsTable.issueDate,
      dueDate: billingDocumentsTable.dueDate,
      terms: billingDocumentsTable.terms,
      gstRate: billingDocumentsTable.gstRate,
      gstInclusive: billingDocumentsTable.gstInclusive,
      notes: billingDocumentsTable.notes,
      status: billingDocumentsTable.status,
      createdAt: billingDocumentsTable.createdAt,
      updatedAt: billingDocumentsTable.updatedAt,
    })
    .from(billingDocumentsTable)
    .innerJoin(companiesTable, eq(billingDocumentsTable.companyId, companiesTable.id))
    .where(eq(billingDocumentsTable.id, id))
    .limit(1);
  if (docRows.length === 0) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  // Ownership check: company/client users can only read their own billing docs
  const docSessionRole = req.session?.role;
  const docLinkedId = req.session?.linkedEntityId;
  if (docSessionRole === "superuser" || docSessionRole === "admin") {
    // unrestricted
  } else if (docSessionRole === "company") {
    const eid = Number(docLinkedId);
    if (!docLinkedId || Number.isNaN(eid) || docRows[0]!.companyId !== eid) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (docSessionRole === "client") {
    const eid = Number(docLinkedId);
    if (!docLinkedId || Number.isNaN(eid) || docRows[0]!.clientId !== eid) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (docSessionRole === "employee" || docSessionRole === "agent") {
    // employee/agent have no billing access (no billing tab in UI)
    res.status(403).json({ error: "Access denied" });
    return;
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const items = await db
    .select()
    .from(billingItemsTable)
    .where(eq(billingItemsTable.documentId, id))
    .orderBy(billingItemsTable.position, billingItemsTable.id);
  res.json({ ...docRows[0], items });
});

router.post("/billing/documents", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateBillingDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  if (data.kind !== "invoice" && data.kind !== "quotation") {
    res.status(400).json({ error: "Invalid kind" });
    return;
  }
  const issue = normalizeDate(data.issueDate);
  if (issue === "invalid" || issue == null) {
    res.status(400).json({ error: "Invalid issueDate" });
    return;
  }
  const due = normalizeDate(data.dueDate);
  if (due === "invalid") {
    res.status(400).json({ error: "Invalid dueDate" });
    return;
  }
  const gstRate = normalizeMoney(data.gstRate ?? "0", 2, 3);
  if (gstRate == null) {
    res.status(400).json({ error: "Invalid gstRate" });
    return;
  }
  // Validate items
  const normalizedItems: { position: number; description: string; detail: string | null; qty: string; rate: string; amount: string }[] = [];
  if (!Array.isArray(data.items) || data.items.length === 0) {
    res.status(400).json({ error: "At least one line item is required" });
    return;
  }
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    const desc = (it.description ?? "").trim();
    if (!desc) {
      res.status(400).json({ error: `Item ${i + 1}: description is required` });
      return;
    }
    const qty = normalizeMoney(it.qty ?? "1", 4, 10);
    const rate = normalizeMoney(it.rate ?? "0", 4, 10);
    if (qty == null || rate == null) {
      res.status(400).json({ error: `Item ${i + 1}: invalid qty or rate` });
      return;
    }
    const lineAmount = (Number(qty) * Number(rate)).toFixed(2);
    normalizedItems.push({
      position: i,
      description: desc,
      detail: it.detail?.trim() || null,
      qty,
      rate,
      amount: lineAmount,
    });
  }

  // Numbering is computed as max+1 inside the transaction. Two concurrent
  // creates for the same kind can race and both compute the same next number;
  // the kind+number unique index then rejects one of them with code 23505.
  // Retry a small number of times so callers never see that as a 500.
  const MAX_ATTEMPTS = 5;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await db.transaction(async (tx) => {
        const issuerId = await getOrCreateIssuerId(tx);
        const number = await allocateNumber(data.kind as "invoice" | "quotation", tx);
        const inserted = await tx
          .insert(billingDocumentsTable)
          .values({
            kind: data.kind,
            number,
            companyId: issuerId,
            clientId: data.clientId ?? null,
            customerName: data.customerName.trim(),
            customerAddress: data.customerAddress?.trim() || null,
            customerTin: data.customerTin?.trim() || null,
            issueDate: issue,
            dueDate: due,
            terms: data.terms?.trim() || null,
            gstRate,
            gstInclusive: data.gstInclusive ?? true,
            notes: data.notes?.trim() || null,
            status: data.status ?? "draft",
          })
          .returning();
        const doc = inserted[0];
        await tx.insert(billingItemsTable).values(
          normalizedItems.map((it) => ({ ...it, documentId: doc.id })),
        );
        return doc;
      });
      res.status(201).json({ id: result.id });
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string })?.code;
      // 23505 = unique_violation; only retry that, fail fast on anything else.
      if (code !== "23505") break;
      req.log.warn(
        { attempt, kind: data.kind },
        "Billing number collision, retrying allocation",
      );
    }
  }
  req.log.error({ err: lastErr }, "Failed to create billing document");
  res.status(500).json({ error: "Failed to create document" });
});

router.patch("/billing/documents/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const paramsParsed = UpdateBillingDocumentParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }
  const bodyParsed = UpdateBillingDocumentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const { id } = paramsParsed.data;
  const data = bodyParsed.data;

  // Build patch for the document row
  const patch: Record<string, unknown> = {};
  // companyId is intentionally ignored on update — issuer is fixed.
  if (data.customerName !== undefined) patch.customerName = data.customerName.trim();
  if (data.customerAddress !== undefined)
    patch.customerAddress = data.customerAddress?.trim() || null;
  if (data.customerTin !== undefined) patch.customerTin = data.customerTin?.trim() || null;
  if (data.issueDate !== undefined) {
    const v = normalizeDate(data.issueDate);
    if (v === "invalid" || v == null) {
      res.status(400).json({ error: "Invalid issueDate" });
      return;
    }
    patch.issueDate = v;
  }
  if (data.dueDate !== undefined) {
    const v = normalizeDate(data.dueDate);
    if (v === "invalid") {
      res.status(400).json({ error: "Invalid dueDate" });
      return;
    }
    patch.dueDate = v;
  }
  if (data.terms !== undefined) patch.terms = data.terms?.trim() || null;
  if (data.gstRate !== undefined) {
    const v = normalizeMoney(data.gstRate, 2, 3);
    if (v == null) {
      res.status(400).json({ error: "Invalid gstRate" });
      return;
    }
    patch.gstRate = v;
  }
  if (data.gstInclusive !== undefined) patch.gstInclusive = data.gstInclusive;
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
  if (data.status !== undefined) patch.status = data.status;
  if ("clientId" in data) patch.clientId = data.clientId ?? null;

  // Validate replacement items if provided
  let normalizedItems: { position: number; description: string; detail: string | null; qty: string; rate: string; amount: string }[] | null = null;
  if (data.items !== undefined) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      res.status(400).json({ error: "At least one line item is required" });
      return;
    }
    normalizedItems = [];
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      const desc = (it.description ?? "").trim();
      if (!desc) {
        res.status(400).json({ error: `Item ${i + 1}: description is required` });
        return;
      }
      const qty = normalizeMoney(it.qty ?? "1", 4, 10);
      const rate = normalizeMoney(it.rate ?? "0", 4, 10);
      if (qty == null || rate == null) {
        res.status(400).json({ error: `Item ${i + 1}: invalid qty or rate` });
        return;
      }
      const lineAmount = (Number(qty) * Number(rate)).toFixed(2);
      normalizedItems.push({
        position: i,
        description: desc,
        detail: it.detail?.trim() || null,
        qty,
        rate,
        amount: lineAmount,
      });
    }
  }

  try {
    await db.transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        const updated = await tx
          .update(billingDocumentsTable)
          .set(patch)
          .where(eq(billingDocumentsTable.id, id))
          .returning({ id: billingDocumentsTable.id });
        if (updated.length === 0) {
          throw new Error("not_found");
        }
      } else {
        // Make sure the row exists even if only items are changing
        const existing = await tx
          .select({ id: billingDocumentsTable.id })
          .from(billingDocumentsTable)
          .where(eq(billingDocumentsTable.id, id))
          .limit(1);
        if (existing.length === 0) throw new Error("not_found");
      }
      if (normalizedItems) {
        await tx.delete(billingItemsTable).where(eq(billingItemsTable.documentId, id));
        await tx
          .insert(billingItemsTable)
          .values(normalizedItems.map((it) => ({ ...it, documentId: id })));
      }
    });
    res.status(204).end();
  } catch (err) {
    if ((err as Error).message === "not_found") {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    req.log.error({ err }, "Failed to update billing document");
    res.status(500).json({ error: "Failed to update document" });
  }
});

router.delete("/billing/documents/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = DeleteBillingDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const deleted = await db
    .delete(billingDocumentsTable)
    .where(eq(billingDocumentsTable.id, parsed.data.id))
    .returning({ id: billingDocumentsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.status(204).end();
});

export default router;
