import session, { type SessionOptions } from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import pg from "pg";
import { logger } from "./logger";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    userId?: number;
    role?: string;
    userEmail?: string;
    userName?: string;
    linkedEntityId?: string;
  }
}

const SESSION_SECRET = process.env["SESSION_SECRET"];
const DATABASE_URL = process.env["DATABASE_URL"];

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required for session storage");
}

// Dedicated pool for session reads/writes (separate from drizzle's pool so
// session traffic doesn't contend with app queries).
const pool = new pg.Pool({ connectionString: DATABASE_URL });

/**
 * Create the session table at startup. We do this ourselves instead of relying
 * on connect-pg-simple's `createTableIfMissing` because the bundler (esbuild)
 * does not copy that package's `table.sql` into dist/. The PK existence check
 * is scoped to the `session` table specifically, not the global constraint
 * namespace.
 *
 * Callers must `await` this before binding the HTTP listener so that early
 * requests don't hit a partially-initialized store.
 */
export async function ensureSessionTable(): Promise<void> {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "session" (
         "sid"    varchar NOT NULL COLLATE "default",
         "sess"   json    NOT NULL,
         "expire" timestamp(6) NOT NULL
       ) WITH (OIDS=FALSE);
       DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM pg_constraint c
           JOIN pg_class t ON c.conrelid = t.oid
           WHERE c.conname = 'session_pkey'
             AND t.relname = 'session'
         ) THEN
           ALTER TABLE "session" ADD CONSTRAINT "session_pkey"
             PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
         END IF;
       END $$;
       CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`
    );
  } catch (err) {
    logger.error({ err }, "Failed to ensure session table exists");
    throw err;
  }
}

const PgStore = connectPgSimple(session);

const store = new PgStore({
  pool,
  tableName: "session",
  createTableIfMissing: false,
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const opts: SessionOptions = {
  name: "leo.sid",
  secret: SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    // Replit's preview proxy terminates TLS; trust X-Forwarded-Proto via app.set("trust proxy", 1)
    // and let express-session decide secure flag based on connection.
    secure: process.env["NODE_ENV"] === "production",
    maxAge: SEVEN_DAYS_MS,
  },
};

export const sessionMiddleware: RequestHandler = session(opts);
