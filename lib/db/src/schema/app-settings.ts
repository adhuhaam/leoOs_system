import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// Singleton row holding tenant-wide system settings. We store a literal id of 1
// so there's only ever one configuration row to read/write.
export const appSettingsTable = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  appName: text("app_name").notNull().default("LEO OS"),
  accentHue: integer("accent_hue").notNull().default(162),

  // Organization branding (used in the sidebar, login screen, dashboard, and
  // PDF letterheads when no per-company override exists).
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  companyWebsite: text("company_website"),
  companyRegistrationNumber: text("company_registration_number"),
  // Inline base64 data URL (data:image/png;base64,…). Keeps it portable and
  // matches how letterhead images are already stored on the companies table.
  logoImage: text("logo_image"),

  // scrypt hash of the override password. When NULL, auth falls back to the
  // APP_PASSWORD environment variable.
  passwordHash: text("password_hash"),

  // Static token for the Chrome extension (Authorization: Bearer <token>).
  // NULL means no token has been generated yet.
  extensionToken: text("extension_token"),

  // Optional user-supplied OpenAI API key. When set this takes priority over
  // the Replit AI Integrations proxy, allowing the app to run on a Raspberry
  // Pi or any host without the Replit environment.
  openaiApiKey: text("openai_api_key"),

  // Google OAuth client IDs (stored in DB so superusers can configure via UI).
  // googleClientId     — Web client ID (used for backend token verification).
  // googleClientSecret — Web client secret (needed by some OAuth flows).
  // googleClientIdIos  — iOS client ID (bundle-specific, for Expo / native iOS).
  // googleClientIdAndroid — Android client ID.
  googleClientId: text("google_client_id"),
  googleClientSecret: text("google_client_secret"),
  googleClientIdIos: text("google_client_id_ios"),
  googleClientIdAndroid: text("google_client_id_android"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
