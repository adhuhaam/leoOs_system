import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  // todo | in_progress | done
  status: text("status").notNull().default("todo"),
  // low | medium | high
  priority: text("priority").notNull().default("medium"),
  // Optional due date (date only, no time-of-day)
  dueDate: date("due_date"),
  // Self-reference for subtasks. If a parent is deleted we cascade so we
  // never end up with orphaned subtasks pointing at nothing.
  parentId: integer("parent_id").references((): AnyPgColumn => tasksTable.id, {
    onDelete: "cascade",
  }),
  // Manual ordering within a list / parent. New rows go to the end.
  position: integer("position").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type TaskRecord = typeof tasksTable.$inferSelect;
