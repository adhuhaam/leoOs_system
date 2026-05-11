import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const passwordsTable = pgTable("passwords", {
  id: serial("id").primaryKey(),
  website: text("website").notNull(),
  owner: text("owner").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPasswordSchema = createInsertSchema(passwordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPassword = z.infer<typeof insertPasswordSchema>;
export type PasswordRecord = typeof passwordsTable.$inferSelect;
