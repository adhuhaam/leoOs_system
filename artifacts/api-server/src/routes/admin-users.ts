import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { z } from "zod/v4";
import { hashPassword } from "../lib/crypto";

const router: IRouter = Router();

function userShape(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isApproved: u.isApproved,
    linkedEntityId: u.linkedEntityId,
    hasPassword: u.passwordHash != null,
    hasGoogleId: u.googleId != null,
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /admin/users
router.get("/admin/users", async (_req, res) => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(asc(usersTable.createdAt));
  res.json(users.map(userShape));
});

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  role: z
    .enum(["superuser", "admin", "client", "company", "employee", "agent"])
    .optional(),
  isApproved: z.boolean().optional(),
  linkedEntityId: z.string().nullable().optional(),
  newPassword: z.string().min(6).nullable().optional(),
});

// PATCH /admin/users/:id
router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, role, isApproved, linkedEntityId, newPassword } = parsed.data;

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name.trim();
  if (role !== undefined) patch.role = role;
  if (isApproved !== undefined) patch.isApproved = isApproved;
  if (linkedEntityId !== undefined)
    patch.linkedEntityId = linkedEntityId ?? null;
  if (newPassword !== null && newPassword !== undefined && newPassword.length > 0) {
    patch.passwordHash = await hashPassword(newPassword);
  } else if (newPassword === null) {
    patch.passwordHash = null;
  }

  if (Object.keys(patch).length === 0) {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(userShape(users[0]!));
    return;
  }

  const updated = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, id))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(userShape(updated[0]!));
});

// DELETE /admin/users/:id
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const deleted = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
