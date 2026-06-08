import { pgTable, serial, integer, numeric, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { passportsTable } from "./passports";
import { billingDocumentsTable } from "./billing";

export const salaryRecordsTable = pgTable(
  "salary_records",
  {
    id: serial("id").primaryKey(),
    passportId: integer("passport_id")
      .notNull()
      .references(() => passportsTable.id, { onDelete: "cascade" }),
    month: integer("month").notNull(), // 1–12
    year: integer("year").notNull(),
    basicSalary: numeric("basic_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    foodAllowance: numeric("food_allowance", { precision: 14, scale: 2 }).notNull().default("0"),
    transportAllowance: numeric("transport_allowance", { precision: 14, scale: 2 }).notNull().default("0"),
    otherAllowances: numeric("other_allowances", { precision: 14, scale: 2 }).notNull().default("0"),
    deductions: numeric("deductions", { precision: 14, scale: 2 }).notNull().default("0"),
    otherExpenses: numeric("other_expenses", { precision: 14, scale: 2 }).notNull().default("0"),
    netSalary: numeric("net_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    invoiceId: integer("invoice_id").references(() => billingDocumentsTable.id, { onDelete: "set null" }),
    daysWorked: integer("days_worked").notNull().default(0),
    notes: text("notes"),
    status: text("status").notNull().default("draft"), // 'draft' | 'confirmed'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("salary_records_passport_month_year_unique").on(t.passportId, t.month, t.year)],
);

export const insertSalaryRecordSchema = createInsertSchema(salaryRecordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSalaryRecord = z.infer<typeof insertSalaryRecordSchema>;
export type SalaryRecord = typeof salaryRecordsTable.$inferSelect;
