import {
  pgTable,
  text,
  serial,
  integer,
  numeric,
  date,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { clientsTable } from "./clients";

// Single table for both invoices and quotations. We discriminate on `kind` so
// we can share numbering, render, and listing logic. Customer details are
// snapshotted onto the document — there is no separate customers table.
export const billingDocumentsTable = pgTable("billing_documents", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // 'invoice' | 'quotation'
  // Human-readable number, e.g. INV-000008 / QT-000009. Unique per kind.
  number: text("number").notNull(),
  // Issuer company — soft restrict so we don't lose documents if a company
  // is removed. Routes refuse delete on companies that have documents.
  companyId: integer("company_id")
    .notNull()
    .references((): AnyPgColumn => companiesTable.id, { onDelete: "restrict" }),
  // Optional FK back to the clients table — set when created via the client
  // picker so the client-detail view can filter reliably by ID.
  clientId: integer("client_id").references((): AnyPgColumn => clientsTable.id, { onDelete: "set null" }),
  // Bill-to (snapshotted on create/update, not joined)
  customerName: text("customer_name").notNull(),
  customerAddress: text("customer_address"),
  customerTin: text("customer_tin"),
  // Dates and terms
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  terms: text("terms"),
  // GST: rate in percent (e.g. "8.00") and whether the line totals already
  // include the tax (Tax Inclusive vs Tax Exclusive).
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  gstInclusive: boolean("gst_inclusive").notNull().default(true),
  notes: text("notes"),
  status: text("status").notNull().default("draft"), // draft | sent | paid | void
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => ({
  // Numbers must be unique within their kind. Two different kinds can share
  // sequences (INV-000001 and QT-000001 can co-exist) but never two of the
  // same kind.
  numberUniquePerKind: uniqueIndex("billing_documents_kind_number_unique").on(t.kind, t.number),
}));

export const billingItemsTable = pgTable("billing_items", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references((): AnyPgColumn => billingDocumentsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  description: text("description").notNull(),
  // Optional sub-description ("All Governmental charges and salary for...")
  detail: text("detail"),
  // 4-decimal precision so we can hold rates like 244.1666 from the sample.
  qty: numeric("qty", { precision: 14, scale: 4 }).notNull().default("1"),
  rate: numeric("rate", { precision: 14, scale: 4 }).notNull().default("0"),
  // 2-decimal stored line total (qty * rate, rounded). Persisted so reports
  // and prints match what was saved at the time.
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
});

export const insertBillingDocumentSchema = createInsertSchema(billingDocumentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBillingDocument = z.infer<typeof insertBillingDocumentSchema>;
export type BillingDocument = typeof billingDocumentsTable.$inferSelect;

export const insertBillingItemSchema = createInsertSchema(billingItemsTable).omit({ id: true });
export type InsertBillingItem = z.infer<typeof insertBillingItemSchema>;
export type BillingItem = typeof billingItemsTable.$inferSelect;
