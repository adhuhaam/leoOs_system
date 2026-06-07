import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import {
  CreateCompanyBody,
  UpdateCompanyParams,
  UpdateCompanyBody,
  DeleteCompanyParams,
} from "@workspace/api-zod";
import { requireRole } from "./auth";

const router: IRouter = Router();

// Hard cap on inline base64 branding images (keeps PDF render + payloads bounded).
const MAX_IMAGE_BYTES = 600 * 1024; // ≈ 600 KB raw bytes
const DATA_URL_RE = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Validates a base64 image data URL on the server side. Returns null on success
 * or a human-readable error message. We accept null (clear image) and undefined
 * (field not provided), reject everything else that isn't a small PNG/JPEG.
 */
function validateImageDataUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return `${label} must be a string`;
  const m = value.match(DATA_URL_RE);
  if (!m) return `${label} must be a data:image/(png|jpeg);base64 URL`;
  // Approximate decoded size from base64 length (avoids decoding twice).
  const base64Len = m[2].length;
  const padding = m[2].endsWith("==") ? 2 : m[2].endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64Len * 3) / 4) - padding;
  if (decodedBytes > MAX_IMAGE_BYTES) {
    return `${label} exceeds ${(MAX_IMAGE_BYTES / 1024).toFixed(0)} KB limit`;
  }
  return null;
}

router.get("/companies", async (req, res): Promise<void> => {
  const withBranding = req.query.withBranding === "true";

  // Role-scoped: company users only see their own record
  const sessionRole = req.session?.role;
  const linkedEntityId = req.session?.linkedEntityId;
  if (sessionRole === "company" && linkedEntityId) {
    const eid = Number(linkedEntityId);
    if (!Number.isNaN(eid)) {
      const single = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, eid))
        .limit(1);
      const result = single.map((r) => ({
        ...r,
        letterheadImage: withBranding ? r.letterheadImage : null,
        signatureImage: withBranding ? r.signatureImage : null,
      }));
      res.json(result);
      return;
    }
  }

  // Default list omits the heavy base64 image fields. Set ?withBranding=true on
  // the Settings page to retrieve them. This keeps the LOA form / dashboard fast.
  const rows = await db
    .select({
      id: companiesTable.id,
      name: companiesTable.name,
      address: companiesTable.address,
      email: companiesTable.email,
      phone: companiesTable.phone,
      country: companiesTable.country,
      registrationNumber: companiesTable.registrationNumber,
      signatoryName: companiesTable.signatoryName,
      signatoryDesignation: companiesTable.signatoryDesignation,
      letterheadImage: withBranding ? companiesTable.letterheadImage : (companiesTable.id as unknown as typeof companiesTable.letterheadImage),
      signatureImage: withBranding ? companiesTable.signatureImage : (companiesTable.id as unknown as typeof companiesTable.signatureImage),
      createdAt: companiesTable.createdAt,
      updatedAt: companiesTable.updatedAt,
    })
    .from(companiesTable)
    .orderBy(companiesTable.name);

  // When branding wasn't requested, replace the placeholder fields with null so
  // the API contract stays honest.
  const out = withBranding
    ? rows
    : rows.map((r) => ({ ...r, letterheadImage: null, signatureImage: null }));
  res.json(out);
});

router.post("/companies", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const lhErr = validateImageDataUrl(parsed.data.letterheadImage, "letterheadImage");
  const sigErr = validateImageDataUrl(parsed.data.signatureImage, "signatureImage");
  if (lhErr || sigErr) {
    res.status(400).json({ error: lhErr ?? sigErr });
    return;
  }
  const [company] = await db.insert(companiesTable).values(parsed.data).returning();
  res.status(201).json(company);
});

router.patch("/companies/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const params = UpdateCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateCompanyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const lhErr = validateImageDataUrl(body.data.letterheadImage, "letterheadImage");
  const sigErr = validateImageDataUrl(body.data.signatureImage, "signatureImage");
  if (lhErr || sigErr) {
    res.status(400).json({ error: lhErr ?? sigErr });
    return;
  }
  const [company] = await db
    .update(companiesTable)
    .set(body.data)
    .where(eq(companiesTable.id, params.data.id))
    .returning();
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  res.json(company);
});

router.delete("/companies/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const params = DeleteCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [company] = await db
    .delete(companiesTable)
    .where(eq(companiesTable.id, params.data.id))
    .returning();
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
