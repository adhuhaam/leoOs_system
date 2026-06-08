import { Router, type IRouter } from "express";
import { eq, asc, sql, isNull } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_STATUS = new Set(["todo", "in_progress", "done"]);
const VALID_PRIORITY = new Set(["low", "medium", "high"]);

router.get("/tasks", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(tasksTable)
    .orderBy(asc(tasksTable.position), asc(tasksTable.id));
  res.json(rows);
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const title = parsed.data.title.trim();
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const status = parsed.data.status ?? "todo";
  const priority = parsed.data.priority ?? "medium";
  if (!VALID_STATUS.has(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  if (!VALID_PRIORITY.has(priority)) {
    res.status(400).json({ error: "Invalid priority" });
    return;
  }
  // Validate parent exists if provided
  if (parsed.data.parentId != null) {
    const [parent] = await db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.id, parsed.data.parentId));
    if (!parent) {
      res.status(400).json({ error: "Parent task not found" });
      return;
    }
  }
  // New task goes to the end of its sibling group (same parent_id bucket)
  const parentId = parsed.data.parentId ?? null;
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${tasksTable.position}), 0)` })
    .from(tasksTable)
    .where(
      parentId == null
        ? isNull(tasksTable.parentId)
        : eq(tasksTable.parentId, parentId),
    );
  const [row] = await db
    .insert(tasksTable)
    .values({
      title,
      notes: parsed.data.notes?.trim() || null,
      status,
      priority,
      dueDate: parsed.data.dueDate || null,
      parentId,
      position: Number(maxPos) + 1,
      completedAt: status === "done" ? new Date() : null,
    })
    .returning();
  req.log.info({ id: row.id }, "task created");
  res.status(201).json(row);
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const patch: Partial<typeof tasksTable.$inferInsert> = {};
  if (body.data.title !== undefined) {
    const v = body.data.title.trim();
    if (!v) {
      res.status(400).json({ error: "Title cannot be empty" });
      return;
    }
    patch.title = v;
  }
  if (body.data.notes !== undefined) {
    patch.notes = body.data.notes?.trim() || null;
  }
  if (body.data.status !== undefined) {
    if (!VALID_STATUS.has(body.data.status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    patch.status = body.data.status;
    // Stamp completedAt when transitioning to/from done
    patch.completedAt = body.data.status === "done" ? new Date() : null;
  }
  if (body.data.priority !== undefined) {
    if (!VALID_PRIORITY.has(body.data.priority)) {
      res.status(400).json({ error: "Invalid priority" });
      return;
    }
    patch.priority = body.data.priority;
  }
  if (body.data.dueDate !== undefined) {
    patch.dueDate = body.data.dueDate || null;
  }
  if (body.data.parentId !== undefined) {
    const newParentId = body.data.parentId;
    if (newParentId === params.data.id) {
      res.status(400).json({ error: "A task cannot be its own parent" });
      return;
    }
    if (newParentId != null) {
      // Validate parent exists and walk up its ancestors to make sure we
      // are not creating a cycle (e.g. parenting onto a descendant).
      let cursor: number | null = newParentId;
      const seen = new Set<number>();
      while (cursor != null) {
        if (cursor === params.data.id) {
          res
            .status(400)
            .json({ error: "Cannot move a task under one of its descendants" });
          return;
        }
        if (seen.has(cursor)) break; // safety: bail on any pre-existing cycle
        seen.add(cursor);
        const [parentRow] = await db
          .select({ id: tasksTable.id, parentId: tasksTable.parentId })
          .from(tasksTable)
          .where(eq(tasksTable.id, cursor));
        if (!parentRow) {
          res.status(400).json({ error: "Parent task not found" });
          return;
        }
        cursor = parentRow.parentId;
      }
    }
    patch.parentId = newParentId ?? null;
  }
  if (body.data.position !== undefined) {
    patch.position = body.data.position;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(tasksTable)
    .set(patch)
    .where(eq(tasksTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  req.log.info({ id: row.id, fields: Object.keys(patch) }, "task updated");

  res.json(row);
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  req.log.info({ id: row.id }, "task deleted");
  res.sendStatus(204);
});

export default router;
