import { Router } from "express";
import { z } from "zod/v4";
import { eq, and, asc, isNotNull, type SQL } from "drizzle-orm";
import { db, salaryRecordsTable, passportsTable, billingDocumentsTable } from "@workspace/db";
import { requireRole } from "./auth";

const router = Router();

function computeNet(data: {
  basicSalary?: string | null;
  foodAllowance?: string | null;
  transportAllowance?: string | null;
  otherAllowances?: string | null;
  deductions?: string | null;
  otherExpenses?: string | null;
}): string {
  const n = (v: string | null | undefined) => Number(v ?? "0") || 0;
  const net =
    n(data.basicSalary) +
    n(data.foodAllowance) +
    n(data.transportAllowance) +
    n(data.otherAllowances) +
    n(data.otherExpenses) -
    n(data.deductions);
  return net.toFixed(2);
}

function salaryShape(
  r: typeof salaryRecordsTable.$inferSelect,
  passport?: { fullName: string | null; passportNumber: string | null } | null,
) {
  return {
    id: r.id,
    passportId: r.passportId,
    month: r.month,
    year: r.year,
    basicSalary: r.basicSalary,
    foodAllowance: r.foodAllowance,
    transportAllowance: r.transportAllowance,
    otherAllowances: r.otherAllowances,
    deductions: r.deductions,
    otherExpenses: r.otherExpenses,
    netSalary: r.netSalary,
    invoiceId: r.invoiceId ?? null,
    notes: r.notes,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    employeeName: passport?.fullName ?? null,
    passportNumber: passport?.passportNumber ?? null,
  };
}

// GET /salary-records
// Admin/superuser → all; employee → own via linkedEntityId, gated by payment_received invoice
router.get("/salary-records", async (req, res) => {
  const role = (req.session as { role?: string }).role ?? "";
  const linkedEntityId = (req.session as { linkedEntityId?: string | null }).linkedEntityId;

  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const statusFilter = req.query.status as string | undefined;

  const isAdmin = role === "superuser" || role === "admin";

  // ── Employee: inner-join with billing_documents, only show payment_received ──
  if (!isAdmin) {
    if (role === "employee" && linkedEntityId) {
      const passportId = Number(linkedEntityId);
      const rows = await db
        .select({
          record: salaryRecordsTable,
          fullName: passportsTable.fullName,
          passportNumber: passportsTable.passportNumber,
        })
        .from(salaryRecordsTable)
        .leftJoin(passportsTable, eq(salaryRecordsTable.passportId, passportsTable.id))
        .innerJoin(
          billingDocumentsTable,
          eq(salaryRecordsTable.invoiceId, billingDocumentsTable.id),
        )
        .where(
          and(
            eq(salaryRecordsTable.passportId, passportId),
            eq(billingDocumentsTable.status, "payment_received"),
          ),
        )
        .orderBy(asc(salaryRecordsTable.year), asc(salaryRecordsTable.month));

      return res.json(
        rows.map((r) =>
          salaryShape(r.record, { fullName: r.fullName, passportNumber: r.passportNumber }),
        ),
      );
    }
    return res.json([]);
  }

  // ── Admin: all records with optional filters ────────────────────────────────
  let passportIdFilter: number | undefined;
  if (req.query.passportId) passportIdFilter = Number(req.query.passportId);

  const conditions: SQL[] = [];
  if (passportIdFilter !== undefined) conditions.push(eq(salaryRecordsTable.passportId, passportIdFilter));
  if (month !== undefined) conditions.push(eq(salaryRecordsTable.month, month));
  if (year !== undefined) conditions.push(eq(salaryRecordsTable.year, year));
  if (statusFilter) conditions.push(eq(salaryRecordsTable.status, statusFilter));

  const rows = await db
    .select({
      record: salaryRecordsTable,
      fullName: passportsTable.fullName,
      passportNumber: passportsTable.passportNumber,
    })
    .from(salaryRecordsTable)
    .leftJoin(passportsTable, eq(salaryRecordsTable.passportId, passportsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(salaryRecordsTable.year), asc(salaryRecordsTable.month));

  return res.json(
    rows.map((r) =>
      salaryShape(r.record, { fullName: r.fullName, passportNumber: r.passportNumber }),
    ),
  );
});

const CreateSalarySchema = z.object({
  passportId: z.number().int(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  basicSalary: z.string().default("0"),
  foodAllowance: z.string().default("0"),
  transportAllowance: z.string().default("0"),
  otherAllowances: z.string().default("0"),
  deductions: z.string().default("0"),
  otherExpenses: z.string().default("0"),
  notes: z.string().nullable().optional(),
  status: z.enum(["draft", "confirmed"]).default("draft"),
});

// POST /salary-records — admin only
router.post("/salary-records", requireRole("superuser", "admin"), async (req, res) => {
  const parsed = CreateSalarySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const data = parsed.data;

  const netSalary = computeNet(data);

  try {
    const [row] = await db
      .insert(salaryRecordsTable)
      .values({
        passportId: data.passportId,
        month: data.month,
        year: data.year,
        basicSalary: data.basicSalary,
        foodAllowance: data.foodAllowance,
        transportAllowance: data.transportAllowance,
        otherAllowances: data.otherAllowances,
        deductions: data.deductions,
        otherExpenses: data.otherExpenses,
        netSalary,
        notes: data.notes ?? null,
        status: data.status,
      })
      .returning();

    const passport = await db.query.passportsTable.findFirst({
      where: eq(passportsTable.id, data.passportId),
      columns: { fullName: true, passportNumber: true },
    });

    return res.status(201).json(salaryShape(row, passport));
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "23505") {
      return res.status(409).json({ error: "A salary record already exists for this employee, month and year." });
    }
    throw err;
  }
});

const UpdateSalarySchema = z.object({
  basicSalary: z.string().optional(),
  foodAllowance: z.string().optional(),
  transportAllowance: z.string().optional(),
  otherAllowances: z.string().optional(),
  deductions: z.string().optional(),
  otherExpenses: z.string().optional(),
  invoiceId: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["draft", "confirmed"]).optional(),
});

// PATCH /salary-records/:id — admin only
router.patch("/salary-records/:id", requireRole("superuser", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSalarySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const existing = await db.query.salaryRecordsTable.findFirst({
    where: eq(salaryRecordsTable.id, id),
  });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { invoiceId, ...salaryFields } = parsed.data;
  const merged = { ...existing, ...salaryFields };
  const netSalary = computeNet(merged);

  const updateSet: Record<string, unknown> = { ...salaryFields, netSalary, updatedAt: new Date() };
  if (invoiceId !== undefined) updateSet.invoiceId = invoiceId;

  const [updated] = await db
    .update(salaryRecordsTable)
    .set(updateSet)
    .where(eq(salaryRecordsTable.id, id))
    .returning();

  const passport = await db.query.passportsTable.findFirst({
    where: eq(passportsTable.id, updated.passportId),
    columns: { fullName: true, passportNumber: true },
  });

  return res.json(salaryShape(updated, passport));
});

// DELETE /salary-records/:id — admin only
router.delete("/salary-records/:id", requireRole("superuser", "admin"), async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db
    .delete(salaryRecordsTable)
    .where(eq(salaryRecordsTable.id, id))
    .returning();
  if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
  return res.status(204).send();
});

export default router;
