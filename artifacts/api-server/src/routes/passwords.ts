import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, passwordsTable } from "@workspace/db";
import {
  CreatePasswordBody,
  UpdatePasswordParams,
  UpdatePasswordBody,
  DeletePasswordParams,
  ListPasswordsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Strip the `password` field from any value before logging. We never want
// secrets in the log stream.
function safeForLog<T extends { password?: unknown }>(v: T): Omit<T, "password"> {
  const { password: _ignored, ...rest } = v;
  void _ignored;
  return rest;
}

router.get("/passwords", async (req, res): Promise<void> => {
  const parsed = ListPasswordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search } = parsed.data;
  const rows = await db
    .select()
    .from(passwordsTable)
    .orderBy(asc(passwordsTable.website), asc(passwordsTable.owner));
  const filtered = search
    ? rows.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.website.toLowerCase().includes(q) ||
          p.owner.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q)
        );
      })
    : rows;
  res.json(filtered);
});

router.post("/passwords", async (req, res): Promise<void> => {
  const parsed = CreatePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const website = parsed.data.website.trim();
  const owner = parsed.data.owner.trim();
  const username = parsed.data.username.trim();
  const password = parsed.data.password;
  if (!website || !owner || !username || !password) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  const [row] = await db
    .insert(passwordsTable)
    .values({ website, owner, username, password })
    .returning();
  req.log.info({ id: row.id, entry: safeForLog(row) }, "password entry created");
  res.status(201).json(row);
});

router.patch("/passwords/:id", async (req, res): Promise<void> => {
  const params = UpdatePasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdatePasswordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const patch: { website?: string; owner?: string; username?: string; password?: string } = {};
  if (body.data.website !== undefined) {
    const v = body.data.website.trim();
    if (!v) {
      res.status(400).json({ error: "Website cannot be empty" });
      return;
    }
    patch.website = v;
  }
  if (body.data.owner !== undefined) {
    const v = body.data.owner.trim();
    if (!v) {
      res.status(400).json({ error: "Owner cannot be empty" });
      return;
    }
    patch.owner = v;
  }
  if (body.data.username !== undefined) {
    const v = body.data.username.trim();
    if (!v) {
      res.status(400).json({ error: "Username cannot be empty" });
      return;
    }
    patch.username = v;
  }
  if (body.data.password !== undefined) {
    if (!body.data.password) {
      res.status(400).json({ error: "Password cannot be empty" });
      return;
    }
    patch.password = body.data.password;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(passwordsTable)
    .set(patch)
    .where(eq(passwordsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Password entry not found" });
    return;
  }
  req.log.info({ id: row.id, entry: safeForLog(row) }, "password entry updated");
  res.json(row);
});

router.delete("/passwords/:id", async (req, res): Promise<void> => {
  const params = DeletePasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(passwordsTable)
    .where(eq(passwordsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Password entry not found" });
    return;
  }
  req.log.info({ id: row.id }, "password entry deleted");
  res.sendStatus(204);
});

export default router;
