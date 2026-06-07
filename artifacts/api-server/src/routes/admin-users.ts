import { Router, type IRouter, type Request, type Response } from "express";
import { eq, asc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { z } from "zod/v4";
import { hashPassword } from "../lib/crypto";

const router: IRouter = Router();

const ROLES = ["superuser", "admin", "client", "company", "employee", "agent"] as const;
type Role = (typeof ROLES)[number];

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

/**
 * Role-transition policy (server-side):
 * - Only superusers may assign or remove the "superuser" role.
 * - An admin may assign any role EXCEPT superuser.
 * - Neither role may escalate their own account.
 */
function canAssignRole(actorRole: string, targetUserId: number, actorUserId: number | undefined, newRole: Role): string | null {
  if (targetUserId === actorUserId) {
    return "You cannot change your own role";
  }
  if (newRole === "superuser" && actorRole !== "superuser") {
    return "Only superusers may grant the superuser role";
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------

router.get("/admin/users", async (_req, res) => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(asc(usersTable.createdAt));
  res.json(users.map(userShape));
});

// ---------------------------------------------------------------------------
// POST /admin/users  — create a user directly (admin+superuser)
// ---------------------------------------------------------------------------

const CreateUserBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES).default("agent"),
  isApproved: z.boolean().default(true),
  password: z.string().min(6),
  linkedEntityId: z.string().nullable().optional(),
});

router.post("/admin/users", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, role, isApproved, password, linkedEntityId } = parsed.data;
  const actorRole = req.session?.role ?? "";
  const actorId = req.session?.userId;

  // Enforce role-transition policy
  const policyErr = canAssignRole(actorRole, -1, actorId, role);
  if (policyErr) {
    res.status(403).json({ error: policyErr });
    return;
  }

  const normalEmail = email.toLowerCase().trim();
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalEmail))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const created = await db
    .insert(usersTable)
    .values({
      email: normalEmail,
      name: name.trim(),
      role,
      isApproved,
      passwordHash,
      linkedEntityId: linkedEntityId ?? null,
    })
    .returning();

  res.status(201).json(userShape(created[0]!));
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id
// ---------------------------------------------------------------------------

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  isApproved: z.boolean().optional(),
  linkedEntityId: z.string().nullable().optional(),
  newPassword: z.string().min(6).nullable().optional(),
});

router.patch("/admin/users/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
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
  const actorRole = req.session?.role ?? "";
  const actorId = req.session?.userId;

  // Always load target first — enforce that only superusers may modify ANY field
  // on a superuser account, regardless of which fields are being patched.
  const targetRows = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (targetRows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const targetRole = targetRows[0]!.role;

  // Non-superusers may not touch superuser accounts at all
  if (targetRole === "superuser" && actorRole !== "superuser") {
    res.status(403).json({ error: "Only superusers may modify another superuser's account" });
    return;
  }

  // Enforce role-transition policy if role is being changed
  if (role !== undefined) {
    const policyErr = canAssignRole(actorRole, id, actorId, role);
    if (policyErr) {
      res.status(403).json({ error: policyErr });
      return;
    }
  }

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

// ---------------------------------------------------------------------------
// DELETE /admin/users/:id
// ---------------------------------------------------------------------------

router.delete("/admin/users/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const actorId = req.session?.userId;
  if (id === actorId) {
    res.status(403).json({ error: "You cannot delete your own account" });
    return;
  }

  // Only superuser may delete another superuser
  const actorRole = req.session?.role ?? "";
  const target = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (target.length > 0 && target[0]!.role === "superuser" && actorRole !== "superuser") {
    res.status(403).json({ error: "Only superusers may delete another superuser's account" });
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
