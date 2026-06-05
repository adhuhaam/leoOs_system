import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const APP_PASSWORD = process.env["APP_PASSWORD"];
if (!APP_PASSWORD) {
  throw new Error("APP_PASSWORD environment variable is required for authentication");
}

const router: IRouter = Router();

// Format: scrypt$<salt-hex>$<key-hex>
async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPasswordHash(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = await scrypt(plain, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// Look up the override hash if one has been set; otherwise fall back to the
// APP_PASSWORD env var (used for fresh installs).
async function checkPassword(plain: string): Promise<boolean> {
  const rows = await db
    .select({ hash: appSettingsTable.passwordHash })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  const stored = rows[0]?.hash;
  if (stored) return verifyPasswordHash(plain, stored);
  return plain === APP_PASSWORD;
}

router.get("/auth/me", (req, res) => {
  res.json({ authenticated: Boolean(req.session?.authenticated) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  const ok = await checkPassword(parsed.data.password);
  if (!ok) {
    req.log.warn({ ip: req.ip }, "Failed login attempt");
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  // Regenerate the session ID on successful login to defeat session fixation:
  // any pre-existing SID an attacker may have planted is discarded and a fresh
  // one is issued before we mark the session as authenticated.
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      req.log.error({ err: regenErr }, "Failed to regenerate session");
      res.status(500).json({ error: "Failed to log in" });
      return;
    }
    req.session.authenticated = true;
    req.session.save((saveErr) => {
      if (saveErr) {
        req.log.error({ err: saveErr }, "Failed to save session");
        res.status(500).json({ error: "Failed to log in" });
        return;
      }
      res.sendStatus(204);
    });
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
    }
    res.clearCookie("leo.sid");
    res.sendStatus(204);
  });
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;
  const ok = await checkPassword(currentPassword);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const hash = await hashPassword(newPassword);
  // Make sure the singleton row exists, then update the hash.
  await db.insert(appSettingsTable).values({ id: 1 }).onConflictDoNothing();
  await db
    .update(appSettingsTable)
    .set({ passwordHash: hash })
    .where(eq(appSettingsTable.id, 1));
  res.sendStatus(204);
});

// GET /auth/extension-token — return current token (generate one if none exists yet)
router.get("/auth/extension-token", async (req, res): Promise<void> => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const rows = await db
    .select({ extensionToken: appSettingsTable.extensionToken })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  let token = rows[0]?.extensionToken ?? null;
  if (!token) {
    token = randomBytes(32).toString("hex");
    await db
      .insert(appSettingsTable)
      .values({ id: 1, extensionToken: token })
      .onConflictDoUpdate({ target: appSettingsTable.id, set: { extensionToken: token } });
  }
  res.json({ token });
});

// POST /auth/extension-token/regenerate — rotate the token (old one immediately invalid)
router.post("/auth/extension-token/regenerate", async (req, res): Promise<void> => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = randomBytes(32).toString("hex");
  await db
    .insert(appSettingsTable)
    .values({ id: 1, extensionToken: token })
    .onConflictDoUpdate({ target: appSettingsTable.id, set: { extensionToken: token } });
  res.json({ token });
});

/**
 * Middleware that gates protected API routes. Returns 401 (not 302) so the
 * SPA can decide where to redirect.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: "Authentication required" });
}

/**
 * Like requireAuth but also accepts a valid Authorization: Bearer <token>
 * header. Used for routes that the Chrome extension needs to call.
 */
export async function requireAuthOrToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.session?.authenticated) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const rows = await db
        .select({ extensionToken: appSettingsTable.extensionToken })
        .from(appSettingsTable)
        .where(eq(appSettingsTable.id, 1))
        .limit(1);
      const stored = rows[0]?.extensionToken;
      if (stored && stored === token) {
        next();
        return;
      }
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }
  res.status(401).json({ error: "Authentication required" });
}

export default router;
