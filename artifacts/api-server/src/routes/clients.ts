import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, clientsTable, type Client } from "@workspace/db";
import {
  CreateClientBody,
  UpdateClientParams,
  UpdateClientBody,
  DeleteClientParams,
  ListClientsQueryParams,
} from "@workspace/api-zod";
import { requireRole } from "./auth";

const router: IRouter = Router();

router.get("/clients", async (req, res): Promise<void> => {
  const parsed = ListClientsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search } = parsed.data;

  // Role-scoped — explicit allowlist
  const sessionRole = req.session?.role;
  const linkedEntityId = req.session?.linkedEntityId;
  let rows: Client[];
  if (sessionRole === "superuser" || sessionRole === "admin" || sessionRole === "employee" || sessionRole === "agent") {
    rows = await db.select().from(clientsTable).orderBy(asc(clientsTable.name));
  } else if (sessionRole === "client") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked client on session" });
      return;
    }
    rows = await db.select().from(clientsTable).where(eq(clientsTable.id, eid)).orderBy(asc(clientsTable.name));
  } else if (sessionRole === "company") {
    // company users have no reason to browse clients; hard-deny (linkage irrelevant)
    res.status(403).json({ error: "Access denied" });
    return;
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const filtered = search
    ? rows.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.contactPerson?.toLowerCase().includes(q) ?? false) ||
          (c.email?.toLowerCase().includes(q) ?? false) ||
          (c.phone?.toLowerCase().includes(q) ?? false)
        );
      })
    : rows;
  res.json(filtered);
});

router.post("/clients", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Name cannot be empty" });
    return;
  }
  const [row] = await db
    .insert(clientsTable)
    .values({ ...parsed.data, name })
    .returning();
  res.status(201).json(row);
});

router.patch("/clients/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateClientBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const patch = { ...body.data };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) {
      res.status(400).json({ error: "Name cannot be empty" });
      return;
    }
    patch.name = trimmed;
  }
  const [row] = await db
    .update(clientsTable)
    .set(patch)
    .where(eq(clientsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(row);
});

router.delete("/clients/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // FK on passports.client_id is ON DELETE SET NULL, so allocated candidates
  // are unlinked atomically by the database. No manual two-step needed.
  const [row] = await db
    .delete(clientsTable)
    .where(eq(clientsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
