import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { db, loaTable, companiesTable, passportsTable } from "@workspace/db";
import {
  CreateLoaBody,
  GetLoaParams,
  UpdateLoaParams,
  UpdateLoaBody,
  DeleteLoaParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "./auth";

const router: IRouter = Router();

// GET /loa — list (scoped by role)
router.get("/loa", requireAuth, async (req, res): Promise<void> => {
  const rawPassportId = req.query.passportId;
  const passportId = rawPassportId ? parseInt(String(rawPassportId), 10) : null;
  const loaRole = req.session?.role;
  const linkedEntityId = req.session?.linkedEntityId;

  // Build scope conditions
  const conditions = [];
  if (passportId && !isNaN(passportId)) {
    conditions.push(eq(loaTable.passportId, passportId));
  }

  if (loaRole === "superuser" || loaRole === "admin") {
    // unrestricted read
  } else if (loaRole === "company") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    conditions.push(eq(loaTable.companyId, eid));
  } else if (loaRole === "employee" || loaRole === "agent") {
    // employee/agent have no LOA access (not in their nav)
    res.status(403).json({ error: "Access denied" });
    return;
  } else if (loaRole === "client") {
    // clients don't have LOAs directly — deny
    res.status(403).json({ error: "Access denied" });
    return;
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const entries = await db.select().from(loaTable).where(where).orderBy(desc(loaTable.createdAt));
  res.json(entries);
});

// POST /loa — create (superuser/admin/company only)
router.post("/loa", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const parsed = CreateLoaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Company users: hard-deny if no linkage; enforce own company
  const actorRole = req.session?.role ?? "";
  const actorLinkedId = req.session?.linkedEntityId;
  if (actorRole === "company") {
    const eid = Number(actorLinkedId);
    if (!actorLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    if (parsed.data.companyId !== eid) {
      res.status(403).json({ error: "Access denied — you may only create LOAs for your own company" });
      return;
    }
  }

  const [loa] = await db.insert(loaTable).values(parsed.data).returning();

  // Mark the related passport as submitted now that the wizard is fully complete.
  if (parsed.data.passportId) {
    await db
      .update(passportsTable)
      .set({ submitted: true })
      .where(eq(passportsTable.id, parsed.data.passportId));
  }

  res.status(201).json(loa);
});

// GET /loa/:id — detail (requireAuth + ownership check)
router.get("/loa/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetLoaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [loa] = await db.select().from(loaTable).where(eq(loaTable.id, params.data.id));
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }

  // Ownership check
  const detailRole = req.session?.role;
  const detailLinkedId = req.session?.linkedEntityId;
  if (detailRole === "superuser" || detailRole === "admin") {
    // unrestricted
  } else if (detailRole === "company") {
    const eid = Number(detailLinkedId);
    if (!detailLinkedId || Number.isNaN(eid) || loa.companyId !== eid) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (detailRole === "employee" || detailRole === "agent") {
    // employee/agent have no LOA access
    res.status(403).json({ error: "Access denied" });
    return;
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(loa);
});

// PATCH /loa/:id — update (superuser/admin/company, company scoped)
router.patch("/loa/:id", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const params = UpdateLoaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateLoaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // Company users can only update LOAs linked to their own company
  const patchRole = req.session?.role ?? "";
  const patchLinkedId = req.session?.linkedEntityId;
  if (patchRole === "company") {
    const eid = Number(patchLinkedId);
    if (!patchLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    const [existing] = await db.select({ companyId: loaTable.companyId }).from(loaTable).where(eq(loaTable.id, params.data.id));
    if (!existing || existing.companyId !== eid) {
      res.status(403).json({ error: "Access denied — LOA not linked to your company" });
      return;
    }
  }

  const [loa] = await db
    .update(loaTable)
    .set(body.data)
    .where(eq(loaTable.id, params.data.id))
    .returning();
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }
  res.json(loa);
});

// DELETE /loa/:id — delete (superuser/admin/company; company scoped to own)
router.delete("/loa/:id", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const params = DeleteLoaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Company role: ownership check before delete
  const delRole = req.session?.role ?? "";
  const delLinkedId = req.session?.linkedEntityId;
  if (delRole === "company") {
    const eid = Number(delLinkedId);
    if (!delLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    const [existing] = await db.select({ companyId: loaTable.companyId }).from(loaTable).where(eq(loaTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "LOA not found" });
      return;
    }
    if (existing.companyId !== eid) {
      res.status(403).json({ error: "Access denied — LOA not linked to your company" });
      return;
    }
  }

  const [loa] = await db
    .delete(loaTable)
    .where(eq(loaTable.id, params.data.id))
    .returning();
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }
  res.sendStatus(204);
});

// PDF generation endpoint (requireAuth + ownership check)
router.get("/loa/:id/pdf", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [loa] = await db.select().from(loaTable).where(eq(loaTable.id, id));
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }

  // Ownership check for PDF
  const pdfRole = req.session?.role;
  const pdfLinkedId = req.session?.linkedEntityId;
  if (pdfRole === "superuser" || pdfRole === "admin") {
    // unrestricted
  } else if (pdfRole === "company") {
    const eid = Number(pdfLinkedId);
    if (!pdfLinkedId || Number.isNaN(eid) || loa.companyId !== eid) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (pdfRole === "employee" || pdfRole === "agent") {
    // employee/agent have no LOA access
    res.status(403).json({ error: "Access denied" });
    return;
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Look up the originating company so we can use its letterhead + signature.
  // Fall back gracefully if the company was deleted or never linked.
  let letterheadImage: string | null = null;
  let signatureImage: string | null = null;
  if (loa.companyId != null) {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, loa.companyId));
    if (company) {
      letterheadImage = company.letterheadImage ?? null;
      signatureImage = company.signatureImage ?? null;
    }
  }

  // Decode "data:image/...;base64,XXXX" into a Buffer that pdfkit can embed.
  const decodeDataUrl = (dataUrl: string | null): Buffer | null => {
    if (!dataUrl) return null;
    const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!m) return null;
    try {
      return Buffer.from(m[2], "base64");
    } catch {
      return null;
    }
  };
  const letterheadBuf = decodeDataUrl(letterheadImage);
  const signatureBuf = decodeDataUrl(signatureImage);

  // A4: 595.28 x 841.89 points
  const doc = new PDFDocument({ size: "A4", margin: 60, info: { Title: "Letter of Appointment" } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="LOA-${loa.candidateName?.replace(/\s+/g, "-") ?? id}.pdf"`
  );
  doc.pipe(res);

  // ─── Letterhead image (centered, capped width) ───────────────────────────
  if (letterheadBuf) {
    try {
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const maxW = Math.min(pageWidth, 360);
      const imgX = doc.page.margins.left + (pageWidth - maxW) / 2;
      const imgY = doc.y;
      doc.image(letterheadBuf, imgX, imgY, { fit: [maxW, 90], align: "center" });
      doc.y = imgY + 90;
      doc.moveDown(1);
    } catch (err) {
      req.log.warn({ err }, "Failed to embed company letterhead — skipping");
    }
  }

  // ─── Title ───────────────────────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("LETTER OF APPOINTMENT", { align: "center" })
    .moveDown(1.5);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const sectionHeader = (label: string) => {
    doc.font("Helvetica-Bold").fontSize(11).text(label, { align: "left" }).moveDown(0.3);
  };

  const field = (label: string, value: string | null | undefined) => {
    const val = (value ?? "").trim();
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`${label}: `, { continued: true })
      .font("Helvetica")
      .text(val);
  };

  const lineGap = () => doc.moveDown(0.25);

  const fmtDate = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };

  // ─── 1. Employer ──────────────────────────────────────────────────────────
  sectionHeader("1. Details of Employer;");
  field("Name", loa.companyName); lineGap();
  field("Address", loa.companyAddress); lineGap();
  field("Contact Details / Email address", loa.companyEmail); lineGap();
  field("Phone Number", loa.companyPhone); lineGap();
  field("Country of origin", loa.companyCountry); lineGap();
  field("Registration Number/ID Card", loa.companyRegistrationNumber);
  doc.moveDown(1);

  // ─── 2. Employee ──────────────────────────────────────────────────────────
  sectionHeader("2. Details of Employee;");
  field("Name", loa.candidateName); lineGap();
  field("Permanent Address", loa.candidateAddress); lineGap();
  field("Nationality", loa.candidateNationality); lineGap();
  field("Date of Birth", fmtDate(loa.candidateDateOfBirth)); lineGap();
  field("Passport Number", loa.candidatePassportNumber); lineGap();
  field("Emergency Contact Details (name and contact number)", loa.candidateEmergencyContact);
  doc.moveDown(1);

  // ─── 4. Employment (sample skips section 3) ──────────────────────────────
  sectionHeader("4. Details of Employment;");
  field("Job Title / Occupation", loa.jobTitle); lineGap();
  doc.font("Helvetica-Bold").fontSize(10).text("Work Type : ", { continued: true })
    .font("Helvetica").text((loa.workType ?? "").trim()); lineGap();
  field("Basic Salary (USD)", loa.basicSalary); lineGap();
  field("Date of Salary payment", loa.salaryPaymentDate);
  doc.moveDown(0.8);
  field("Work site", loa.workSite); lineGap();
  field("Date of Commence", loa.dateOfCommence?.trim() || "Date of Arrival"); lineGap();
  field("Job Description", loa.jobDescription?.trim() || "Job Description will be given the time of signing the contract"); lineGap();
  field(
    "Working Hours",
    loa.workingHours?.trim() ||
      "09:00 to 17:00 Saturday to Sunday * even though Friday is a holiday, your work may require your attendance to work due to the nature of business."
  ); lineGap();
  field("Work Status (Permanent / Contract)", loa.workStatus?.trim() || "Contract based"); lineGap();
  field(
    "Contract Duration (if Contracted employee)",
    loa.contractDuration?.trim() || "Contract will be for 2 years, Probation period is 3 months"
  );
  doc.moveDown(1.2);

  // ─── Signatory ──────────────────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(11).text("Details of Signatory;").moveDown(0.3);
  field("Name", loa.signatoryName); lineGap();
  field("Designation", loa.signatoryDesignation);
  doc.moveDown(2);

  // ─── Signature line ─────────────────────────────────────────────────────
  if (signatureBuf) {
    doc.font("Helvetica-Bold").fontSize(10).text("Signature: ", { continued: false });
    try {
      const sigY = doc.y;
      doc.image(signatureBuf, doc.page.margins.left + 10, sigY, { fit: [160, 50] });
      doc.y = sigY + 55;
    } catch (err) {
      req.log.warn({ err }, "Failed to embed company signature — skipping");
      doc.moveDown(2);
    }
  } else {
    doc.moveDown(1);
    field("Signature", "");
    doc.moveDown(0.6);
  }
  field("Date", fmtDate(loa.signatureDate));

  doc.end();
});

export default router;
