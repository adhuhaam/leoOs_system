import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { eq, desc, isNull, and } from "drizzle-orm";
import { db, passportsTable, clientsTable, companiesTable } from "@workspace/db";
import {
  GetPassportParams,
  UpdatePassportParams,
  UpdatePassportBody,
  ListPassportsQueryParams,
} from "@workspace/api-zod";
import { extractPassportData } from "../lib/ocr";
import { logger } from "../lib/logger";
import { requireAuth } from "./auth";
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

async function bufferToBase64Image(
  buffer: Buffer,
  mimetype: string
): Promise<{ base64: string; mime: string }> {
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
      const base64 = imgBuffer.toString("base64");
      return { base64, mime: "image/png" };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  // For images, resize if too large and convert to JPEG
  const processed = await sharp(buffer)
    .resize(1600, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  return { base64: processed.toString("base64"), mime: "image/jpeg" };
}

// GET /passports — list all (open)
router.get("/passports", async (req, res): Promise<void> => {
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

  // Only return fully-submitted records (wizard completed + LOA created).
  // Draft records (submitted=false) are invisible to the list/master-list.
  const conditions = [eq(passportsTable.submitted, true)];
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

// POST /passports/upload — upload and extract (session only)
router.post("/passports/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  // Parse optional companyId from multipart body (sent as string field)
  const rawCompanyId = req.body?.companyId;
  const parsedCompanyId = rawCompanyId ? parseInt(String(rawCompanyId), 10) : null;
  const companyId = parsedCompanyId && !isNaN(parsedCompanyId) ? parsedCompanyId : null;

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

  // Process asynchronously and update record
  (async () => {
    try {
      const { base64, mime } = await bufferToBase64Image(req.file!.buffer, req.file!.mimetype);
      const extracted = await extractPassportData(base64, mime);

      await db
        .update(passportsTable)
        .set({
          ...extracted,
          status: "completed",
        })
        .where(eq(passportsTable.id, passport.id));

      logger.info({ passportId: passport.id }, "OCR extraction completed");
    } catch (err) {
      logger.error({ err, passportId: passport.id }, "OCR extraction failed");
      await db
        .update(passportsTable)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        })
        .where(eq(passportsTable.id, passport.id));
    }
  })();

  res.status(201).json(passport);
});

// GET /passports/stats — dashboard stats (open, submitted records only)
router.get("/passports/stats", async (_req, res): Promise<void> => {
  const all = await db
    .select()
    .from(passportsTable)
    .where(eq(passportsTable.submitted, true))
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

// GET /passports/:id — get single (open)
router.get("/passports/:id", async (req, res): Promise<void> => {
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

  res.json(passport);
});

// PATCH /passports/:id — update (session only)
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

  res.json(passport);
});

// DELETE /passports/:id — delete (session only)
router.delete("/passports/:id", requireAuth, async (req, res): Promise<void> => {
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
