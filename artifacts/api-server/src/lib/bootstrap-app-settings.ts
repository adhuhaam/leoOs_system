import pg from "pg";
import { logger } from "./logger";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required for bootstrap");
}

// Dedicated short-lived pool just for bootstrap. We close it once we're done so
// it doesn't linger.
const pool = new pg.Pool({ connectionString: DATABASE_URL });

/**
 * Ensure the `app_settings` singleton table exists and contains row id=1.
 *
 * The Drizzle schema is the source of truth for shape, but we don't want a
 * fresh production database to require an out-of-band `drizzle push` for
 * authentication to work — `auth.ts` reads `app_settings.password_hash` on
 * every login, so a missing table would lock everyone out.
 *
 * Runs at process startup before the HTTP listener binds.
 */
export async function ensureAppSettingsTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id integer PRIMARY KEY DEFAULT 1,
        app_name text NOT NULL DEFAULT 'LEO OS',
        accent_hue integer NOT NULL DEFAULT 162,
        company_name text,
        company_address text,
        company_phone text,
        company_email text,
        company_website text,
        company_registration_number text,
        logo_image text,
        password_hash text,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_name text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_address text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_phone text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_email text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_website text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_registration_number text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logo_image text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS password_hash text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS openai_api_key text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_client_id text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_client_secret text;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_client_id_ios text;
      INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);
  } catch (err) {
    logger.error({ err }, "Failed to ensure app_settings table exists");
    throw err;
  }
}
