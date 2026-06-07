import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, loaOptionsTable, LOA_OPTION_CATEGORIES } from "@workspace/db";
import { z } from "zod";
import { requireAuth, requireRole } from "./auth";

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

// GET /loa-options — read (requireAuth; company role scoped to own companyId)
router.get("/loa-options", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "companyId is required and must be a positive integer" });
    return;
  }
  const { companyId, category } = parsed.data;

  // Company role: enforce that the requested companyId matches their linked entity
  const optRole = req.session?.role ?? "";
  const optLinkedId = req.session?.linkedEntityId;
  if (optRole === "company") {
    const eid = Number(optLinkedId);
    if (!optLinkedId || Number.isNaN(eid) || companyId !== eid) {
      res.status(403).json({ error: "Access denied — you may only view options for your own company" });
      return;
    }
  } else if (
    optRole !== "superuser" &&
    optRole !== "admin" &&
    optRole !== "employee" &&
    optRole !== "agent"
  ) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

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

// POST /loa-options — create (superuser/admin/company; company scoped to own)
router.post("/loa-options", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { companyId, category, value: rawValue } = parsed.data;
  const value = rawValue.trim().toLowerCase();
  if (!value) {
    res.status(400).json({ error: "Value cannot be empty" });
    return;
  }

  // Company role: enforce own company
  const createRole = req.session?.role ?? "";
  const createLinkedId = req.session?.linkedEntityId;
  if (createRole === "company") {
    const eid = Number(createLinkedId);
    if (!createLinkedId || Number.isNaN(eid) || companyId !== eid) {
      res.status(403).json({ error: "Access denied — you may only create options for your own company" });
      return;
    }
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

// PATCH /loa-options/:id — update (superuser/admin/company; company scoped)
router.patch("/loa-options/:id", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
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
  const value = body.data.value.trim().toLowerCase();
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

  // Ownership check: company users may only update options for their own company
  const patchRole = req.session?.role ?? "";
  const patchLinkedId = req.session?.linkedEntityId;
  if (patchRole === "company") {
    const eid = Number(patchLinkedId);
    if (!patchLinkedId || Number.isNaN(eid) || current.companyId !== eid) {
      res.status(403).json({ error: "Access denied — option does not belong to your company" });
      return;
    }
  }

  // If caller supplied companyId, it must match the stored row.
  if (body.data.companyId != null && body.data.companyId !== current.companyId) {
    res.status(403).json({ error: "Option does not belong to the specified company" });
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

// DELETE /loa-options/:id — delete (superuser/admin/company; company scoped)
router.delete("/loa-options/:id", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
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

  // Company role: enforce own company
  const delRole = req.session?.role ?? "";
  const delLinkedId = req.session?.linkedEntityId;
  if (delRole === "company") {
    const eid = Number(delLinkedId);
    if (!delLinkedId || Number.isNaN(eid) || current.companyId !== eid) {
      res.status(403).json({ error: "Access denied — option does not belong to your company" });
      return;
    }
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
