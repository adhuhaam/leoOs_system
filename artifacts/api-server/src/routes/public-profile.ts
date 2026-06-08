import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, companiesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/u/:userId", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["userId"] ?? ""), 10);
  if (isNaN(id) || id < 1) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      role: usersTable.role,
      designation: usersTable.designation,
      phone: usersTable.phone,
      companyId: usersTable.companyId,
      companyName: companiesTable.name,
    })
    .from(usersTable)
    .leftJoin(companiesTable, eq(usersTable.companyId, companiesTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const u = rows[0]!;
  res.json({
    id: u.id,
    name: u.name,
    role: u.role,
    designation: u.designation ?? null,
    phone: u.phone ?? null,
    companyName: u.companyName ?? null,
  });
});

export default router;
