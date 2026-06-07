import { Router, type IRouter } from "express";
import { eq, desc, and, sql, type SQL } from "drizzle-orm";
import { db, expensesTable, expenseCategoriesTable } from "@workspace/db";
import {
  CreateExpenseBody,
  UpdateExpenseParams,
  UpdateExpenseBody,
  DeleteExpenseParams,
  ListExpensesQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "./auth";

const router: IRouter = Router();

// numeric(14,2) holds up to 12 digits before the decimal — enforce that here
// so we return a clean 400 instead of letting Postgres throw a 22003 overflow
// (which would surface as a 500). Accepts "1234.5", "1,234.50", " 1234 ".
const MAX_INTEGER_DIGITS = 12;

function normalizeAmount(input: string): string | null {
  const cleaned = input.replace(/,/g, "").trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  // Strip a leading run of zeros (but keep "0") to count significant integer digits.
  const intPart = m[1].replace(/^0+(?=\d)/, "");
  if (intPart.length > MAX_INTEGER_DIGITS) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}

// Empty/blank/legacy "0000-00-00" all collapse to null. Dates must be real
// calendar dates — "2026-13-40" passes the regex but is rejected here so we
// return 400 instead of a Postgres `invalid date` 500.
function normalizeDate(input: string | null | undefined): string | null | "invalid" {
  if (input == null) return null;
  const t = input.trim();
  if (!t || t === "0000-00-00") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return "invalid";
  const [, ys, ms, ds] = m;
  const y = Number(ys), mo = Number(ms), d = Number(ds);
  // Build via UTC and round-trip to confirm the components survived (e.g. Feb 30 → Mar 2).
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return "invalid";
  }
  return t;
}

router.get("/expenses", async (req, res): Promise<void> => {
  const parsed = ListExpensesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { categoryId, search } = parsed.data;
  const conds: SQL[] = [];
  if (categoryId !== undefined) conds.push(eq(expensesTable.categoryId, categoryId));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: expensesTable.id,
      categoryId: expensesTable.categoryId,
      categoryName: expenseCategoriesTable.name,
      amount: expensesTable.amount,
      expenseDate: expensesTable.expenseDate,
      remarks: expensesTable.remarks,
      createdAt: expensesTable.createdAt,
      updatedAt: expensesTable.updatedAt,
    })
    .from(expensesTable)
    .innerJoin(
      expenseCategoriesTable,
      eq(expensesTable.categoryId, expenseCategoriesTable.id),
    )
    .where(where)
    .orderBy(desc(expensesTable.createdAt));

  const filtered = search
    ? rows.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.categoryName.toLowerCase().includes(q) ||
          (r.remarks?.toLowerCase().includes(q) ?? false)
        );
      })
    : rows;
  res.json(filtered);
});

router.post("/expenses", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const amount = normalizeAmount(parsed.data.amount);
  if (amount === null) {
    res.status(400).json({
      error: "Amount must be a non-negative number with up to 12 digits and 2 decimals",
    });
    return;
  }
  const dateOrInvalid = normalizeDate(parsed.data.expenseDate);
  if (dateOrInvalid === "invalid") {
    res.status(400).json({ error: "Date must be a valid calendar date (YYYY-MM-DD)" });
    return;
  }
  const exists = await db
    .select({ id: expenseCategoriesTable.id })
    .from(expenseCategoriesTable)
    .where(eq(expenseCategoriesTable.id, parsed.data.categoryId))
    .limit(1);
  if (exists.length === 0) {
    res.status(400).json({ error: "Expense category does not exist" });
    return;
  }
  let inserted;
  try {
    [inserted] = await db
      .insert(expensesTable)
      .values({
        categoryId: parsed.data.categoryId,
        amount,
        expenseDate: dateOrInvalid,
        remarks: parsed.data.remarks?.trim() || null,
      })
      .returning();
  } catch (err) {
    // Defense-in-depth — the precheck above narrows the window, but a category
    // could be deleted between the check and the insert.
    if (isFkViolation(err)) {
      res.status(400).json({ error: "Expense category does not exist" });
      return;
    }
    throw err;
  }

  // Re-fetch with the joined category name so the response shape matches list.
  const [row] = await db
    .select({
      id: expensesTable.id,
      categoryId: expensesTable.categoryId,
      categoryName: expenseCategoriesTable.name,
      amount: expensesTable.amount,
      expenseDate: expensesTable.expenseDate,
      remarks: expensesTable.remarks,
      createdAt: expensesTable.createdAt,
      updatedAt: expensesTable.updatedAt,
    })
    .from(expensesTable)
    .innerJoin(
      expenseCategoriesTable,
      eq(expensesTable.categoryId, expenseCategoriesTable.id),
    )
    .where(eq(expensesTable.id, inserted.id));
  res.status(201).json(row);
});

router.patch("/expenses/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateExpenseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const patch: {
    categoryId?: number;
    amount?: string;
    expenseDate?: string | null;
    remarks?: string | null;
  } = {};
  if (body.data.categoryId !== undefined) {
    const exists = await db
      .select({ id: expenseCategoriesTable.id })
      .from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.id, body.data.categoryId))
      .limit(1);
    if (exists.length === 0) {
      res.status(400).json({ error: "Expense category does not exist" });
      return;
    }
    patch.categoryId = body.data.categoryId;
  }
  if (body.data.amount !== undefined) {
    const amt = normalizeAmount(body.data.amount);
    if (amt === null) {
      res.status(400).json({
        error: "Amount must be a non-negative number with up to 12 digits and 2 decimals",
      });
      return;
    }
    patch.amount = amt;
  }
  if (body.data.expenseDate !== undefined) {
    const dateOrInvalid = normalizeDate(body.data.expenseDate);
    if (dateOrInvalid === "invalid") {
      res.status(400).json({ error: "Date must be a valid calendar date (YYYY-MM-DD)" });
      return;
    }
    patch.expenseDate = dateOrInvalid;
  }
  if (body.data.remarks !== undefined) {
    patch.remarks = body.data.remarks === null ? null : body.data.remarks.trim() || null;
  }

  let updated;
  try {
    [updated] = await db
      .update(expensesTable)
      .set(patch)
      .where(eq(expensesTable.id, params.data.id))
      .returning();
  } catch (err) {
    if (isFkViolation(err)) {
      res.status(400).json({ error: "Expense category does not exist" });
      return;
    }
    throw err;
  }
  if (!updated) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  const [row] = await db
    .select({
      id: expensesTable.id,
      categoryId: expensesTable.categoryId,
      categoryName: expenseCategoriesTable.name,
      amount: expensesTable.amount,
      expenseDate: expensesTable.expenseDate,
      remarks: expensesTable.remarks,
      createdAt: expensesTable.createdAt,
      updatedAt: expensesTable.updatedAt,
    })
    .from(expensesTable)
    .innerJoin(
      expenseCategoriesTable,
      eq(expensesTable.categoryId, expenseCategoriesTable.id),
    )
    .where(eq(expensesTable.id, updated.id));
  res.json(row);
});

router.delete("/expenses/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(expensesTable)
    .where(eq(expensesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.sendStatus(204);
});

// suppress unused import warning when sql util is unused above
void sql;

// Postgres foreign-key violation — surfaced by node-postgres on the `code`
// field. We map this to a clean 400 instead of letting it bubble up as 500.
function isFkViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

export default router;
