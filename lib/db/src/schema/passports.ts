import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { companiesTable } from "./companies";

export const passportsTable = pgTable("passports", {
  id: serial("id").primaryKey(),
  fullName: text("full_name"),
  passportNumber: text("passport_number"),
  dateOfBirth: text("date_of_birth"),
  dateOfIssue: text("date_of_issue"),
  dateOfExpiry: text("date_of_expiry"),
  address: text("address"),
  nationality: text("nationality"),
  status: text("status").notNull().default("processing"),
  submitted: boolean("submitted").notNull().default(false),
  errorMessage: text("error_message"),
  originalFilename: text("original_filename"),
  // Which recruiting company this employee belongs to.
  companyId: integer("company_id").references((): import("drizzle-orm/pg-core").AnyPgColumn => companiesTable.id, { onDelete: "set null" }),
  // Operational fields — where the candidate ends up after onboarding.
  clientId: integer("client_id").references((): import("drizzle-orm/pg-core").AnyPgColumn => clientsTable.id, { onDelete: "set null" }),
  workPermitNumber: text("work_permit_number"),
  agent: text("agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPassportSchema = createInsertSchema(passportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPassport = z.infer<typeof insertPassportSchema>;
export type Passport = typeof passportsTable.$inferSelect;
