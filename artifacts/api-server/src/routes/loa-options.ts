import { Router, type IRouter } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { db, loaOptionsTable, LOA_OPTION_CATEGORIES } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const ListQuery = z.object({
  companyId: z.coerce.number().int().positive(),
  category: z.enum(LOA_OPTION_CATEGORIES).optional(),
});

const CreateBody = z.object({
  companyId: z.number().int().positive(),
  category: z.enum(LOA_OPTION_CATEGORIES),
  value: z.string().min(1),
});

const UpdateBody = z.object({
  value: z.string().min(1),
  companyId: z.number().int().positive().optional(),
});

const IdParam = z.object({ id: z.coerce.number().int().positive() });

router.get("/loa-options", async (req, res): Promise<void> => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "companyId is required and must be a positive integer" });
    return;
  }
  const { companyId, category } = parsed.data;
  const rows = await db
    .select()
    .from(loaOptionsTable)
    .where(
      and(
        eq(loaOptionsTable.companyId, companyId),
        category ? eq(loaOptionsTable.category, category) : undefined
      )
    )
    .orderBy(asc(loaOptionsTable.category), asc(loaOptionsTable.value));
  res.json(rows);
});

router.post("/loa-options", async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { companyId, category, value: rawValue } = parsed.data;
  const value = rawValue.trim();
  if (!value) {
    res.status(400).json({ error: "Value cannot be empty" });
    return;
  }

  // Check for existing duplicate (case-insensitive) within the same company+category.
  const existing = await db
    .select()
    .from(loaOptionsTable)
    .where(
      and(
        eq(loaOptionsTable.companyId, companyId),
        eq(loaOptionsTable.category, category),
        sql`lower(${loaOptionsTable.value}) = lower(${value})`
      )
    );
  if (existing.length > 0) {
    res.status(409).json({ error: "Option already exists in this category" });
    return;
  }

  try {
    const [row] = await db
      .insert(loaOptionsTable)
      .values({ companyId, category, value })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      res.status(409).json({ error: "Option already exists in this category" });
      return;
    }
    req.log.error({ err }, "Failed to create LOA option");
    res.status(500).json({ error: "Failed to create option" });
  }
});

router.patch("/loa-options/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const body = UpdateBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const value = body.data.value.trim();
  if (!value) {
    res.status(400).json({ error: "Value cannot be empty" });
    return;
  }

  const [current] = await db
    .select()
    .from(loaOptionsTable)
    .where(eq(loaOptionsTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "Option not found" });
    return;
  }

  // Ownership check: if caller supplied companyId, it must match the stored row.
  if (body.data.companyId != null && body.data.companyId !== current.companyId) {
    res.status(403).json({ error: "Option does not belong to the specified company" });
    return;
  }

  // Check for duplicates within same company+category, excluding this row.
  const dup = await db
    .select()
    .from(loaOptionsTable)
    .where(
      and(
        eq(loaOptionsTable.companyId, current.companyId),
        eq(loaOptionsTable.category, current.category),
        sql`lower(${loaOptionsTable.value}) = lower(${value})`,
        sql`${loaOptionsTable.id} <> ${params.data.id}`
      )
    );
  if (dup.length > 0) {
    res.status(409).json({ error: "Another option with this value already exists" });
    return;
  }

  try {
    const [row] = await db
      .update(loaOptionsTable)
      .set({ value })
      .where(eq(loaOptionsTable.id, params.data.id))
      .returning();
    res.json(row);
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      res.status(409).json({ error: "Another option with this value already exists" });
      return;
    }
    req.log.error({ err }, "Failed to update LOA option");
    res.status(500).json({ error: "Failed to update option" });
  }
});

router.delete("/loa-options/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [row] = await db
    .delete(loaOptionsTable)
    .where(eq(loaOptionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Option not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
