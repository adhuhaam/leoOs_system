import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { UpdateSystemSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const MAX_IMAGE_BYTES = 600 * 1024;
const DATA_URL_RE = /^data:image\/(png|jpe?g|svg\+xml|webp);base64,([A-Za-z0-9+/=]+)$/;

function validateImageDataUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return `${label} must be a string`;
  const m = value.match(DATA_URL_RE);
  if (!m) return `${label} must be a data:image/(png|jpeg|webp|svg+xml);base64 URL`;
  const base64Len = m[2]!.length;
  const padding = m[2]!.endsWith("==") ? 2 : m[2]!.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64Len * 3) / 4) - padding;
  if (decodedBytes > MAX_IMAGE_BYTES) {
    return `${label} exceeds ${(MAX_IMAGE_BYTES / 1024).toFixed(0)} KB limit`;
  }
  return null;
}

async function readSettings() {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  if (rows.length > 0) return rows[0];
  await db.insert(appSettingsTable).values({ id: 1 }).onConflictDoNothing();
  const again = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  return again[0];
}

function publicShape(row: typeof appSettingsTable.$inferSelect) {
  return {
    appName: row.appName,
    accentHue: row.accentHue,
    companyName: row.companyName,
    companyAddress: row.companyAddress,
    companyPhone: row.companyPhone,
    companyEmail: row.companyEmail,
    companyWebsite: row.companyWebsite,
    companyRegistrationNumber: row.companyRegistrationNumber,
    logoImage: row.logoImage,
    hasCustomPassword: row.passwordHash != null,
    hasOpenAiApiKey: row.openaiApiKey != null,
    googleClientId: row.googleClientId ?? null,
    googleClientSecret: row.googleClientSecret ?? null,
    googleClientIdIos: row.googleClientIdIos ?? null,
    googleClientIdAndroid: row.googleClientIdAndroid ?? null,
  };
}

router.get("/system/settings", async (req, res): Promise<void> => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const role = req.session.role ?? "";
  if (role !== "superuser") {
    res.status(403).json({ error: "Only superusers may view system settings" });
    return;
  }
  const row = await readSettings();
  res.json(publicShape(row!));
});

router.patch("/system/settings", async (req, res): Promise<void> => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  // All system settings writes are superuser-only
  const role = req.session.role ?? "";
  if (role !== "superuser") {
    res.status(403).json({ error: "Only superusers may change system settings" });
    return;
  }

  const parsed = UpdateSystemSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;

  const logoErr = validateImageDataUrl(data.logoImage, "logoImage");
  if (logoErr) {
    res.status(400).json({ error: logoErr });
    return;
  }

  const trimOrNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : v.trim() || null;

  const patch: Record<string, unknown> = {};
  if (data.appName !== undefined) patch.appName = data.appName.trim();
  if (data.accentHue !== undefined) patch.accentHue = data.accentHue;
  if (data.companyName !== undefined) patch.companyName = trimOrNull(data.companyName);
  if (data.companyAddress !== undefined) patch.companyAddress = trimOrNull(data.companyAddress);
  if (data.companyPhone !== undefined) patch.companyPhone = trimOrNull(data.companyPhone);
  if (data.companyEmail !== undefined) patch.companyEmail = trimOrNull(data.companyEmail);
  if (data.companyWebsite !== undefined) patch.companyWebsite = trimOrNull(data.companyWebsite);
  if (data.companyRegistrationNumber !== undefined)
    patch.companyRegistrationNumber = trimOrNull(data.companyRegistrationNumber);
  if (data.logoImage !== undefined) patch.logoImage = data.logoImage ?? null;
  if (data.openaiApiKey !== undefined)
    patch.openaiApiKey = data.openaiApiKey === null ? null : (data.openaiApiKey?.trim() || null);
  if ("googleClientId" in data) patch.googleClientId = trimOrNull(data.googleClientId as string | null);
  if ("googleClientSecret" in data) patch.googleClientSecret = trimOrNull(data.googleClientSecret as string | null);
  if ("googleClientIdIos" in data) patch.googleClientIdIos = trimOrNull(data.googleClientIdIos as string | null);
  if ("googleClientIdAndroid" in data) patch.googleClientIdAndroid = trimOrNull(data.googleClientIdAndroid as string | null);

  await readSettings(); // ensure row exists

  if (Object.keys(patch).length === 0) {
    const row = await readSettings();
    res.json(publicShape(row!));
    return;
  }

  const updated = await db
    .update(appSettingsTable)
    .set(patch)
    .where(eq(appSettingsTable.id, 1))
    .returning();
  res.json(publicShape(updated[0]!));
});

export default router;
