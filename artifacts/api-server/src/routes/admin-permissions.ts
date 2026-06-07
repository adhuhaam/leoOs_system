import { Router, type IRouter, type Request, type Response } from "express";
import { db, rolePermissionsTable } from "@workspace/db";
import { z } from "zod/v4";
import { invalidatePermissionsCache } from "../lib/permissions";

const router: IRouter = Router();

const DEFAULT_PERMISSIONS = [
  // admin: full access to every module
  ...["masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload"].map(
    (module) => ({ role: "admin", module, canView: true, canEdit: true, canDelete: true })
  ),
  // company: can view/edit masterlist+upload+loa; view companies+billing; nothing else
  { role: "company", module: "masterlist", canView: true, canEdit: true, canDelete: false },
  { role: "company", module: "companies", canView: true, canEdit: false, canDelete: false },
  { role: "company", module: "clients", canView: false, canEdit: false, canDelete: false },
  { role: "company", module: "loa", canView: true, canEdit: true, canDelete: false },
  { role: "company", module: "billing", canView: true, canEdit: false, canDelete: false },
  { role: "company", module: "expenses", canView: false, canEdit: false, canDelete: false },
  { role: "company", module: "passwords", canView: false, canEdit: false, canDelete: false },
  { role: "company", module: "upload", canView: true, canEdit: true, canDelete: false },
  // client: masterlist view + billing view
  { role: "client", module: "masterlist", canView: true, canEdit: false, canDelete: false },
  { role: "client", module: "companies", canView: false, canEdit: false, canDelete: false },
  { role: "client", module: "clients", canView: false, canEdit: false, canDelete: false },
  { role: "client", module: "loa", canView: false, canEdit: false, canDelete: false },
  { role: "client", module: "billing", canView: true, canEdit: false, canDelete: false },
  { role: "client", module: "expenses", canView: false, canEdit: false, canDelete: false },
  { role: "client", module: "passwords", canView: false, canEdit: false, canDelete: false },
  { role: "client", module: "upload", canView: false, canEdit: false, canDelete: false },
  // employee: masterlist view only
  ...["masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload"].map(
    (module) => ({
      role: "employee", module,
      canView: module === "masterlist",
      canEdit: false, canDelete: false,
    })
  ),
  // agent: masterlist view only
  ...["masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload"].map(
    (module) => ({
      role: "agent", module,
      canView: module === "masterlist",
      canEdit: false, canDelete: false,
    })
  ),
];

function formatRow(r: typeof rolePermissionsTable.$inferSelect) {
  return {
    role: r.role,
    module: r.module,
    canView: r.canView,
    canEdit: r.canEdit,
    canDelete: r.canDelete,
  };
}

const PermissionsUpdateBody = z.array(
  z.object({
    role: z.string().min(1),
    module: z.string().min(1),
    canView: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
  })
);

// GET /admin/permissions
router.get("/admin/permissions", async (_req: Request, res: Response): Promise<void> => {
  let rows = await db.select().from(rolePermissionsTable);
  if (rows.length === 0) {
    await db.insert(rolePermissionsTable).values(DEFAULT_PERMISSIONS).onConflictDoNothing();
    rows = await db.select().from(rolePermissionsTable);
  }
  res.json(rows.map(formatRow));
});

// PUT /admin/permissions — bulk upsert
router.put("/admin/permissions", async (req: Request, res: Response): Promise<void> => {
  const parsed = PermissionsUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  for (const p of parsed.data) {
    await db
      .insert(rolePermissionsTable)
      .values(p)
      .onConflictDoUpdate({
        target: [rolePermissionsTable.role, rolePermissionsTable.module],
        set: {
          canView: p.canView,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          updatedAt: new Date(),
        },
      });
  }

  invalidatePermissionsCache();

  const rows = await db.select().from(rolePermissionsTable);
  res.json(rows.map(formatRow));
});

export default router;
