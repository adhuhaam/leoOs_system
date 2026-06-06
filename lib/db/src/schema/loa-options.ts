import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const LOA_OPTION_CATEGORIES = ["work_type", "work_site", "job_title"] as const;
export type LoaOptionCategory = (typeof LOA_OPTION_CATEGORIES)[number];

export const loaOptionsTable = pgTable(
  "loa_options",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references((): import("drizzle-orm/pg-core").AnyPgColumn => companiesTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Case-insensitive uniqueness per company so "Manager" and "manager" can't
    // both exist in the same category for the same company.
    uniqueCompanyCategoryValue: uniqueIndex("loa_options_company_category_value_idx").on(
      sql`${t.companyId}`,
      sql`${t.category}`,
      sql`lower(${t.value})`
    ),
  })
);

export const insertLoaOptionSchema = createInsertSchema(loaOptionsTable).omit({ id: true, createdAt: true });
export type InsertLoaOption = z.infer<typeof insertLoaOptionSchema>;
export type LoaOption = typeof loaOptionsTable.$inferSelect;
