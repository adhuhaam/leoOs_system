import pg from "pg";
import { logger } from "./logger";
import { hashPassword } from "./crypto";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required for bootstrap");
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

export async function ensureUsersTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'agent',
        is_approved BOOLEAN NOT NULL DEFAULT false,
        password_hash TEXT,
        linked_entity_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_entity_id TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
    `);
  } catch (err) {
    logger.error({ err }, "Failed to ensure users table exists");
    throw err;
  }
}

export async function seedSuperuser(): Promise<void> {
  const email = process.env["SUPERUSER_EMAIL"];
  const password = process.env["SUPERUSER_PASSWORD"];

  if (!email || !password) {
    logger.warn("SUPERUSER_EMAIL / SUPERUSER_PASSWORD not set — skipping superuser seed");
    return;
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE role = 'superuser' LIMIT 1",
    );
    if ((existing.rowCount ?? 0) > 0) return;

    const hash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (email, name, role, is_approved, password_hash)
       VALUES ($1, 'Superuser', 'superuser', true, $2)
       ON CONFLICT (email) DO UPDATE SET role = 'superuser', is_approved = true`,
      [email.toLowerCase().trim(), hash],
    );
    logger.info({ email }, "Superuser seeded");
  } catch (err) {
    logger.error({ err }, "Failed to seed superuser");
    throw err;
  }
}
