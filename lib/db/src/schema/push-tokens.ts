import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per device push token. The Expo push token itself is the natural
// primary key — devices that uninstall the app will simply produce a new
// token on next install.
export const pushTokensTable = pgTable("push_tokens", {
  token: text("token").primaryKey(),
  // "ios" | "android" | "web"
  platform: text("platform").notNull(),
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
