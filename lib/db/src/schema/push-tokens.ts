import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// One row per device push token. The Expo push token itself is the natural
// primary key — devices that uninstall the app will simply produce a new
// token on next install.
export const pushTokensTable = pgTable("push_tokens", {
  token: text("token").primaryKey(),
  // "ios" | "android" | "web"
  platform: text("platform").notNull(),
  // The user who registered this token — used for targeted push notifications.
  // Nullable so tokens from unauthenticated registration attempts are still stored.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushTokenRecord = typeof pushTokensTable.$inferSelect;
