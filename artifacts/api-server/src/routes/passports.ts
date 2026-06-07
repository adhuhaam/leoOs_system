import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { eq, desc, isNull, and, type SQL } from "drizzle-orm";
import { db, passportsTable, clientsTable, companiesTable, loaTable } from "@workspace/db";
import {
  GetPassportParams,
  UpdatePassportParams,
  UpdatePassportBody,
  ListPassportsQueryParams,
} from "@workspace/api-zod";
import { extractPassportData } from "../lib/ocr";
import { logger } from "../lib/logger";
import { requireAuth, requireRole } from "./auth";
import { fromPath } from "pdf2pic";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import os from "os";

const router: IRouter = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and PDF files are allowed"));
    }
  },
});

async function preprocessImageBuffer(
  buffer: Buffer,
  mimetype: string
): Promise<{ imgBuffer: Buffer; mime: string }> {
  if (mimetype === "application/pdf") {
    // Convert PDF first page to image using temp file
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "passport-"));
    const tmpPdf = path.join(tmpDir, "passport.pdf");

    try {
      await fs.writeFile(tmpPdf, buffer);

      const convert = fromPath(tmpPdf, {
        density: 200,
        saveFilename: "passport",
        savePath: tmpDir,
        format: "png",
        width: 1600,
        height: 1200,
      });

      const result = await convert(1);
      if (!result.path) {
        throw new Error("PDF to image conversion failed");
      }

      const imgBuffer = await fs.readFile(result.path);
      return { imgBuffer, mime: "image/png" };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  // For images, honour EXIF orientation (phone cameras), resize if too large,
  // and normalise to JPEG before sending to the OCR pipeline.
  const imgBuffer = await sharp(buffer)
    .rotate()                                          // auto-rotate from EXIF
    .resize(1600, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  return { imgBuffer, mime: "image/jpeg" };
}

// GET /passports — list (requires auth)
router.get("/passports", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListPassportsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, nationality, status, clientId, companyId } = parsed.data as {
    search?: string;
    nationality?: string;
    status?: string;
    clientId?: string;
    companyId?: string;
  };

  const conditions: SQL[] = [];
  if (nationality) {
    conditions.push(eq(passportsTable.nationality, nationality));
  }
  if (status) {
    conditions.push(eq(passportsTable.status, status));
  }
  if (clientId === "none") {
    conditions.push(isNull(passportsTable.clientId));
  } else if (clientId) {
    const n = Number(clientId);
    if (!Number.isNaN(n)) conditions.push(eq(passportsTable.clientId, n));
  }
  if (companyId === "none") {
    conditions.push(isNull(passportsTable.companyId));
  } else if (companyId) {
    const n = Number(companyId);
    if (!Number.isNaN(n)) conditions.push(eq(passportsTable.companyId, n));
  }

  // Role-scoped filtering — explicit allowlist, hard-deny on missing linkage
  const sessionRole = req.session?.role;
  const linkedEntityId = req.session?.linkedEntityId;
  if (sessionRole === "superuser" || sessionRole === "admin") {
    // unrestricted list
  } else if (sessionRole === "company") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    conditions.push(eq(passportsTable.companyId, eid));
  } else if (sessionRole === "client") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked client on session" });
      return;
    }
    conditions.push(eq(passportsTable.clientId, eid));
  } else if (sessionRole === "employee" || sessionRole === "agent") {
    // read-only, no entity scoping — they see all records (dashboard use)
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Left-join clients and companies so each row carries names for display.
  const results = await db
    .select({
      id: passportsTable.id,
      fullName: passportsTable.fullName,
      passportNumber: passportsTable.passportNumber,
      dateOfBirth: passportsTable.dateOfBirth,
      dateOfIssue: passportsTable.dateOfIssue,
      dateOfExpiry: passportsTable.dateOfExpiry,
      address: passportsTable.address,
      nationality: passportsTable.nationality,
      status: passportsTable.status,
      submitted: passportsTable.submitted,
      errorMessage: passportsTable.errorMessage,
      originalFilename: passportsTable.originalFilename,
      companyId: passportsTable.companyId,
      companyName: companiesTable.name,
      clientId: passportsTable.clientId,
      clientName: clientsTable.name,
      workPermitNumber: passportsTable.workPermitNumber,
      agent: passportsTable.agent,
      createdAt: passportsTable.createdAt,
      updatedAt: passportsTable.updatedAt,
    })
    .from(passportsTable)
    .leftJoin(clientsTable, eq(passportsTable.clientId, clientsTable.id))
    .leftJoin(companiesTable, eq(passportsTable.companyId, companiesTable.id))
    .where(and(...conditions))
    .orderBy(desc(passportsTable.createdAt));

  // Apply search filter in memory (name, passport number, work permit, agent).
  const filtered = search
    ? results.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.fullName?.toLowerCase().includes(q) ||
          p.passportNumber?.toLowerCase().includes(q) ||
          p.workPermitNumber?.toLowerCase().includes(q) ||
          p.agent?.toLowerCase().includes(q)
        );
      })
    : results;

  res.json(filtered);
});

// POST /passports/upload — upload and extract (superuser/admin/company only)
router.post("/passports/upload", requireRole("superuser", "admin", "company"), upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  // Parse optional companyId from multipart body (sent as string field)
  const rawCompanyId = req.body?.companyId;
  const parsedCompanyId = rawCompanyId ? parseInt(String(rawCompanyId), 10) : null;
  let companyId = parsedCompanyId && !isNaN(parsedCompanyId) ? parsedCompanyId : null;

  // Company users: enforce their linked entity — must supply their own companyId
  const uploadRole = req.session?.role ?? "";
  const uploadLinkedId = req.session?.linkedEntityId;
  if (uploadRole === "company") {
    const eid = Number(uploadLinkedId);
    if (!uploadLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    // Force the companyId to the actor's own entity regardless of what was posted
    companyId = eid;
  }

  // Create a pending passport record
  const [passport] = await db
    .insert(passportsTable)
    .values({
      status: "processing",
      originalFilename: req.file.originalname,
      ...(companyId ? { companyId } : {}),
    })
    .returning();

  req.log.info({ passportId: passport.id }, "Passport record created, starting OCR");

  // FILE RETENTION POLICY: uploaded files are NEVER stored anywhere.
  // multer uses memory storage (no disk writes for images).
  // For PDFs, bufferToBase64Image writes a temp file and deletes it in finally{}.
  // We capture the buffer and mimetype here, then immediately release
  // both references once base64 conversion is done — before any await.
  const fileBuffer = req.file.buffer;
  const fileMime = req.file.mimetype;
  // Release multer's reference so the buffer can be GC'd as soon as possible.
  (req.file as { buffer: Buffer | null }).buffer = null as unknown as Buffer;

  (async () => {
    try {
      const { imgBuffer, mime } = await preprocessImageBuffer(fileBuffer, fileMime);

      // Raw upload buffer no longer needed — zero and release before OCR.
      fileBuffer.fill(0);

      const extracted = await extractPassportData(imgBuffer, mime);

      await db
        .update(passportsTable)
        .set({
          ...extracted,
          status: "completed",
        })
        .where(eq(passportsTable.id, passport.id));

      logger.info({ passportId: passport.id }, "OCR extraction completed — file data fully released");
    } catch (err) {
      logger.error({ err, passportId: passport.id }, "OCR extraction failed — deleting draft record");
      // Delete the draft so a failed extraction leaves no trace in the DB.
      await db.delete(passportsTable).where(eq(passportsTable.id, passport.id));
    }
  })();

  res.status(201).json(passport);
});

// GET /passports/stats — dashboard stats
router.get("/passports/stats", requireAuth, async (req, res): Promise<void> => {
  // Build a scoped WHERE so company/client only see their own stats
  const statsRole = req.session?.role;
  const statsLinkedId = req.session?.linkedEntityId;

  const conditions: SQL[] = [];
  if (statsRole === "company") {
    const eid = Number(statsLinkedId);
    if (!statsLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    conditions.push(eq(passportsTable.companyId, eid));
  } else if (statsRole === "client") {
    const eid = Number(statsLinkedId);
    if (!statsLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked client on session" });
      return;
    }
    conditions.push(eq(passportsTable.clientId, eid));
  } else if (
    statsRole !== "superuser" &&
    statsRole !== "admin" &&
    statsRole !== "employee" &&
    statsRole !== "agent"
  ) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const all = await db
    .select()
    .from(passportsTable)
    .where(where)
    .orderBy(desc(passportsTable.createdAt));

  const stats = {
    total: all.length,
    completed: all.filter((p) => p.status === "completed").length,
    processing: all.filter((p) => p.status === "processing").length,
    failed: all.filter((p) => p.status === "failed").length,
    bangladeshi: all.filter((p) => p.nationality === "bangladesh").length,
    indian: all.filter((p) => p.nationality === "india").length,
    recentUploads: all.slice(0, 5),
  };

  res.json(stats);
});

// GET /passports/:id — get single (requires auth)
router.get("/passports/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetPassportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [passport] = await db
    .select({
      id: passportsTable.id,
      fullName: passportsTable.fullName,
      passportNumber: passportsTable.passportNumber,
      dateOfBirth: passportsTable.dateOfBirth,
      dateOfIssue: passportsTable.dateOfIssue,
      dateOfExpiry: passportsTable.dateOfExpiry,
      address: passportsTable.address,
      nationality: passportsTable.nationality,
      status: passportsTable.status,
      submitted: passportsTable.submitted,
      errorMessage: passportsTable.errorMessage,
      originalFilename: passportsTable.originalFilename,
      companyId: passportsTable.companyId,
      companyName: companiesTable.name,
      clientId: passportsTable.clientId,
      clientName: clientsTable.name,
      workPermitNumber: passportsTable.workPermitNumber,
      agent: passportsTable.agent,
      createdAt: passportsTable.createdAt,
      updatedAt: passportsTable.updatedAt,
    })
    .from(passportsTable)
    .leftJoin(clientsTable, eq(passportsTable.clientId, clientsTable.id))
    .leftJoin(companiesTable, eq(passportsTable.companyId, companiesTable.id))
    .where(eq(passportsTable.id, params.data.id));

  if (!passport) {
    res.status(404).json({ error: "Passport not found" });
    return;
  }

  // Ownership check: company/client users can only read their own records.
  // Explicit allowlist — any gap defaults to deny.
  const sessionRole = req.session?.role;
  const linkedEntityId = req.session?.linkedEntityId;
  if (sessionRole === "superuser" || sessionRole === "admin") {
    // unrestricted read
  } else if (sessionRole === "company") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid) || passport.companyId !== eid) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (sessionRole === "client") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid) || passport.clientId !== eid) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (sessionRole === "employee" || sessionRole === "agent") {
    // read-only detail access — no entity scoping required for these roles
  } else {
    // unknown or unexpected role: deny
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(passport);
});

// PATCH /passports/:id — update (admin+superuser, or company within own scope)
router.patch("/passports/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdatePassportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdatePassportBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // Explicit allowlist — superuser/admin unrestricted; company scoped to own; all others denied.
  const patchRole = req.session?.role ?? "";
  const patchLinkedId = req.session?.linkedEntityId;
  if (patchRole === "superuser" || patchRole === "admin") {
    // unrestricted update
  } else if (patchRole === "company") {
    const eid = Number(patchLinkedId);
    if (!patchLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    const [target] = await db
      .select({ companyId: passportsTable.companyId })
      .from(passportsTable)
      .where(eq(passportsTable.id, params.data.id))
      .limit(1);
    if (!target || target.companyId !== eid) {
      res.status(403).json({ error: "Access denied — passport not linked to your company" });
      return;
    }
  } else {
    // client, employee, agent, and any other role: no mutations allowed
    res.status(403).json({ error: "Insufficient permissions to update passports" });
    return;
  }

  // Validate clientId points to an existing client (or null to clear).
  if (body.data.clientId != null) {
    const [exists] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.id, body.data.clientId));
    if (!exists) {
      res.status(400).json({ error: "Allocation client does not exist" });
      return;
    }
  }

  // Validate companyId points to an existing company (or null to clear).
  if ((body.data as { companyId?: number | null }).companyId != null) {
    const cid = (body.data as { companyId?: number | null }).companyId as number;
    const [exists] = await db
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .where(eq(companiesTable.id, cid));
    if (!exists) {
      res.status(400).json({ error: "Company does not exist" });
      return;
    }
  }

  const [passport] = await db
    .update(passportsTable)
    .set({ ...body.data })
    .where(eq(passportsTable.id, params.data.id))
    .returning();

  if (!passport) {
    res.status(404).json({ error: "Passport not found" });
    return;
  }

  // Cascade company change to linked LOA entries so the print view reflects the new company.
  const bodyAny = body.data as { companyId?: number | null };
  if ("companyId" in bodyAny) {
    if (bodyAny.companyId != null) {
      const [company] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, bodyAny.companyId));
      if (company) {
        await db
          .update(loaTable)
          .set({
            companyId: company.id,
            companyName: company.name,
            companyAddress: company.address ?? null,
            companyEmail: company.email ?? null,
            companyPhone: company.phone ?? null,
            companyCountry: company.country ?? null,
            companyRegistrationNumber: company.registrationNumber ?? null,
          })
          .where(eq(loaTable.passportId, params.data.id));
      }
    } else {
      await db
        .update(loaTable)
        .set({ companyId: null, companyName: null, companyAddress: null, companyEmail: null, companyPhone: null, companyCountry: null, companyRegistrationNumber: null })
        .where(eq(loaTable.passportId, params.data.id));
    }
  }

  res.json(passport);
});

// DELETE /passports/:id — delete (superuser/admin only)
router.delete("/passports/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const params = GetPassportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [passport] = await db
    .delete(passportsTable)
    .where(eq(passportsTable.id, params.data.id))
    .returning();

  if (!passport) {
    res.status(404).json({ error: "Passport not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
