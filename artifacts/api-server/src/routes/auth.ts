import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, appSettingsTable, usersTable } from "@workspace/db";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";
import { z } from "zod/v4";
import { OAuth2Client } from "google-auth-library";
import { hashPassword, verifyPasswordHash } from "../lib/crypto";
import { store } from "../lib/session";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

router.get("/auth/me", (req, res): void => {
  const respond = (): void => {
    if (!req.session?.authenticated) {
      res.json({ authenticated: false, userId: null, email: null, name: null, role: null, phone: null, designation: null, companyId: null });
      return;
    }
    const userId = req.session.userId ?? null;
    db.select({
      phone: usersTable.phone,
      designation: usersTable.designation,
      companyId: usersTable.companyId,
    })
      .from(usersTable)
      .where(userId ? eq(usersTable.id, userId) : eq(usersTable.id, -1))
      .limit(1)
      .then(([profile]) => {
        res.json({
          authenticated: true,
          userId,
          email: req.session.userEmail ?? null,
          name: req.session.userName ?? null,
          role: req.session.role ?? null,
          phone: profile?.phone ?? null,
          designation: profile?.designation ?? null,
          companyId: profile?.companyId ?? null,
        });
      })
      .catch((err: unknown) => {
        req.log.error({ err }, "GET /auth/me db lookup failed");
        res.status(500).json({ error: "Internal error" });
      });
  };

  if (req.session?.authenticated) {
    respond();
  } else {
    populateFromBearerToken(req, () => respond());
  }
});

// ---------------------------------------------------------------------------
// PATCH /auth/me — update own profile
// ---------------------------------------------------------------------------

const UpdateProfileBody = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  companyId: z.number().int().nullable().optional(),
});

router.patch("/auth/me", (req, res): void => {
  const doUpdate = async (): Promise<void> => {
    if (!req.session?.authenticated) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { name, phone, designation, companyId } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates["name"] = name;
    if (phone !== undefined) updates["phone"] = phone;
    if (designation !== undefined) updates["designation"] = designation;
    if (companyId !== undefined) updates["companyId"] = companyId;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields provided" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        phone: usersTable.phone,
        designation: usersTable.designation,
        companyId: usersTable.companyId,
      });

    if (name) req.session.userName = name;
    res.json(updated ?? {});
  };

  const run = (): void => {
    doUpdate().catch((err: unknown) => {
      req.log.error({ err }, "PATCH /auth/me failed");
      res.status(500).json({ error: "Internal error" });
    });
  };

  if (req.session?.authenticated) {
    run();
  } else {
    populateFromBearerToken(req, run);
  }
});

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

const RegisterBody = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password, name } = parsed.data;
  const normalEmail = email.toLowerCase().trim();

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalEmail))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const hash = await hashPassword(password);
  await db.insert(usersTable).values({
    email: normalEmail,
    name: name.trim(),
    role: "agent",
    isApproved: false,
    passwordHash: hash,
  });

  res.status(202).json({ message: "Account created, pending admin approval" });
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const { email, password } = parsed.data as { email: string; password: string };
  const normalEmail = email.toLowerCase().trim();

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalEmail))
    .limit(1);

  const user = users[0];

  if (!user || !user.passwordHash) {
    req.log.warn({ email: normalEmail }, "Login attempt for unknown user");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const ok = await verifyPasswordHash(password, user.passwordHash);
  if (!ok) {
    req.log.warn({ email: normalEmail }, "Failed login attempt");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: "Account has been blocked" });
    return;
  }

  if (!user.isApproved) {
    res.status(403).json({ error: "Account pending approval" });
    return;
  }

  req.session.regenerate((regenErr) => {
    if (regenErr) {
      req.log.error({ err: regenErr }, "Failed to regenerate session");
      res.status(500).json({ error: "Failed to log in" });
      return;
    }
    req.session.authenticated = true;
    req.session.userId = user!.id;
    req.session.role = user!.role;
    req.session.userEmail = user!.email;
    req.session.userName = user!.name;
    req.session.linkedEntityId = user!.linkedEntityId ?? undefined;
    req.session.save((saveErr) => {
      if (saveErr) {
        req.log.error({ err: saveErr }, "Failed to save session");
        res.status(500).json({ error: "Failed to log in" });
        return;
      }
      // Return the session ID so mobile clients can use it as a Bearer token
      // without relying on cookies (React Native has no persistent cookie jar).
      res.json({ token: req.session.id });
    });
  });
});

// ---------------------------------------------------------------------------
// GET /auth/mobile-token — returns the session ID for mobile persistent auth
// ---------------------------------------------------------------------------

router.get("/auth/mobile-token", (req, res): void => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.json({ token: req.session.id });
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

router.post("/auth/logout", (req, res): void => {
  // When a mobile client authenticates via Bearer token, the cookie session
  // is a freshly-created empty session — the real session is the one identified
  // by the Bearer token.  Destroy BOTH so the token is fully invalidated.
  const bearerSessionId = (() => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
    return null;
  })();

  const destroyCookieSession = () => {
    req.session.destroy((err) => {
      if (err) req.log.error({ err }, "Failed to destroy cookie session");
      res.clearCookie("leo.sid");
      res.sendStatus(204);
    });
  };

  if (bearerSessionId) {
    store.destroy(bearerSessionId, (err) => {
      if (err) req.log.error({ err }, "Failed to destroy Bearer session");
      destroyCookieSession();
    });
  } else {
    destroyCookieSession();
  }
});

// ---------------------------------------------------------------------------
// POST /auth/change-password
// ---------------------------------------------------------------------------

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
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const users = await db
    .select({ passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const stored = users[0]?.passwordHash;
  if (!stored) {
    res.status(400).json({ error: "No password set. Contact an admin to reset your password." });
    return;
  }

  const ok = await verifyPasswordHash(currentPassword, stored);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const hash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash: hash })
    .where(eq(usersTable.id, userId));

  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Extension token routes
// ---------------------------------------------------------------------------

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
      .onConflictDoUpdate({
        target: appSettingsTable.id,
        set: { extensionToken: token },
      });
  }
  res.json({ token });
});

router.post("/auth/extension-token/regenerate", async (req, res): Promise<void> => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = randomBytes(32).toString("hex");
  await db
    .insert(appSettingsTable)
    .values({ id: 1, extensionToken: token })
    .onConflictDoUpdate({
      target: appSettingsTable.id,
      set: { extensionToken: token },
    });
  res.json({ token });
});

// ---------------------------------------------------------------------------
// GET /settings/google-client-ids  (public — mobile login screen reads this)
// ---------------------------------------------------------------------------

router.get("/settings/google-client-ids", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      googleClientId: appSettingsTable.googleClientId,
      googleClientIdIos: appSettingsTable.googleClientIdIos,
      googleClientIdAndroid: appSettingsTable.googleClientIdAndroid,
    })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  const row = rows[0];
  res.json({
    googleClientId: row?.googleClientId ?? null,
    googleClientIdIos: row?.googleClientIdIos ?? null,
    googleClientIdAndroid: row?.googleClientIdAndroid ?? null,
  });
});

// ---------------------------------------------------------------------------
// POST /auth/google  — verify Google ID token, sign in or create pending account
// ---------------------------------------------------------------------------

const GoogleAuthBody = z.object({
  idToken: z.string().min(1),
});

router.post("/auth/google", async (req, res): Promise<void> => {
  const parsed = GoogleAuthBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { idToken } = parsed.data;

  const rows = await db
    .select({
      googleClientId: appSettingsTable.googleClientId,
      googleClientIdIos: appSettingsTable.googleClientIdIos,
      googleClientIdAndroid: appSettingsTable.googleClientIdAndroid,
    })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);

  const settings = rows[0];
  const audiences = [
    settings?.googleClientId,
    settings?.googleClientIdIos,
    settings?.googleClientIdAndroid,
  ].filter((v): v is string => Boolean(v));

  if (audiences.length === 0) {
    res.status(400).json({ error: "Google Sign-In is not configured" });
    return;
  }

  let googleId: string;
  let email: string;
  let name: string;

  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      res.status(401).json({ error: "Invalid Google token" });
      return;
    }
    googleId = payload.sub;
    email = payload.email;
    name = payload.name ?? email.split("@")[0] ?? "";
  } catch (err) {
    req.log.warn({ err }, "Failed to verify Google ID token");
    res.status(401).json({ error: "Invalid Google token" });
    return;
  }

  const normalEmail = email.toLowerCase().trim();

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalEmail))
    .limit(1);

  let user = existing[0];

  if (!user) {
    const inserted = await db
      .insert(usersTable)
      .values({ email: normalEmail, name, role: "agent", isApproved: false, googleId })
      .returning();
    user = inserted[0]!;
    res.status(202).json({ message: "Account created, pending admin approval" });
    return;
  }

  if (!user.googleId) {
    await db.update(usersTable).set({ googleId }).where(eq(usersTable.id, user.id));
  }

  if (user.isBlocked) {
    res.status(403).json({ error: "Account has been blocked" });
    return;
  }

  if (!user.isApproved) {
    res.status(403).json({ error: "Account pending approval" });
    return;
  }

  req.session.regenerate((regenErr) => {
    if (regenErr) {
      req.log.error({ err: regenErr }, "Failed to regenerate session");
      res.status(500).json({ error: "Failed to sign in" });
      return;
    }
    req.session.authenticated = true;
    req.session.userId = user!.id;
    req.session.role = user!.role;
    req.session.userEmail = user!.email;
    req.session.userName = user!.name;
    req.session.linkedEntityId = user!.linkedEntityId ?? undefined;
    req.session.save((saveErr) => {
      if (saveErr) {
        req.log.error({ err: saveErr }, "Failed to save session");
        res.status(500).json({ error: "Failed to sign in" });
        return;
      }
      res.json({ token: req.session.id });
    });
  });
});

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/**
 * Populate req.session from a Bearer session-ID token sent by mobile clients.
 * Returns true when the session was found and populated, false otherwise.
 */
function populateFromBearerToken(
  req: Request,
  callback: (ok: boolean) => void,
): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    callback(false);
    return;
  }
  const sessionId = auth.slice(7).trim();
  if (!sessionId) {
    callback(false);
    return;
  }
  store.get(sessionId, (err, sessionData) => {
    if (err || !sessionData?.authenticated) {
      callback(false);
      return;
    }
    req.session.authenticated = true;
    req.session.userId = sessionData.userId;
    req.session.role = sessionData.role;
    req.session.userEmail = sessionData.userEmail;
    req.session.userName = sessionData.userName;
    req.session.linkedEntityId = sessionData.linkedEntityId;
    callback(true);
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) {
    next();
    return;
  }
  populateFromBearerToken(req, (ok) => {
    if (ok) {
      next();
    } else {
      res.status(401).json({ error: "Authentication required" });
    }
  });
}

export function requireRole(
  ...roles: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const check = (authenticated: boolean) => {
      if (!authenticated) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const userRole = req.session.role ?? "";
      if (!roles.includes(userRole)) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
      next();
    };

    if (req.session?.authenticated) {
      check(true);
    } else {
      populateFromBearerToken(req, check);
    }
  };
}

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
    } catch {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }
  res.status(401).json({ error: "Authentication required" });
}

export default router;
