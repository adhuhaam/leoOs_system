import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const USER_ROLES = [
  "superuser",
  "admin",
  "client",
  "company",
  "employee",
  "agent",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("agent").$type<UserRole>(),
  isApproved: boolean("is_approved").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  linkedEntityId: text("linked_entity_id"),
  phone: text("phone"),
  designation: text("designation"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
