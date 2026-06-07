import {
  pgTable,
  text,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const PERMISSION_MODULES = [
  "masterlist",
  "companies",
  "clients",
  "loa",
  "billing",
  "expenses",
  "passwords",
  "upload",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    role: text("role").notNull(),
    module: text("module").notNull(),
    canView: boolean("can_view").notNull().default(true),
    canEdit: boolean("can_edit").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.role, table.module] })]
);

export type RolePermission = typeof rolePermissionsTable.$inferSelect;
