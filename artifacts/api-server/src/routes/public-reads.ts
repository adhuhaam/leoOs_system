import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  loaTable,
  companiesTable,
  billingDocumentsTable,
  billingItemsTable,
  clientsTable,
  appSettingsTable,
} from "@workspace/db";

const router: IRouter = Router();

// GET /loa/:id — public read for the LOA print page.
// If the request already has a valid session, defer to the authenticated loaRouter
// (which applies role-scoped ownership checks). Unauthenticated requests (e.g. the
// in-app browser opened from the mobile app) get the data directly.
router.get("/loa/:id", async (req, res, next) => {
  if (req.session?.userId) {
    next("router");
    return;
  }
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [loa] = await db.select().from(loaTable).where(eq(loaTable.id, id));
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }
  res.json(loa);
});

// GET /companies — public read for the LOA print page (fetches branding images).
// Same deferral pattern: authenticated requests fall through to the private
// companiesRouter which applies role-scoped filtering.
router.get("/companies", async (req, res, next) => {
  if (req.session?.userId) {
    next("router");
    return;
  }
  const withBranding = req.query.withBranding === "true";
  const rows = await db
    .select()
    .from(companiesTable)
    .orderBy(companiesTable.name);
  const out = withBranding
    ? rows
    : rows.map((r) => ({ ...r, letterheadImage: null, signatureImage: null }));
  res.json(out);
});

// GET /billing/documents/:id/print — public read for the invoice print page.
// Authenticated requests fall through to the private billingRouter (which applies
// ownership checks). Unauthenticated requests (e.g. the in-app browser opened from
// the mobile app, or a link sent to a client) get the data directly.
// Financial internals (profit, employeeCost) are intentionally not returned.
router.get("/billing/documents/:id/print", async (req, res, next) => {
  if (req.session?.userId) {
    next("router");
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  const [docRows, items, settingsRows] = await Promise.all([
    db
      .select({
        id: billingDocumentsTable.id,
        kind: billingDocumentsTable.kind,
        number: billingDocumentsTable.number,
        companyId: billingDocumentsTable.companyId,
        companyName: companiesTable.name,
        companyAddress: companiesTable.address,
        companyEmail: companiesTable.email,
        companyPhone: companiesTable.phone,
        companyRegistrationNumber: companiesTable.registrationNumber,
        companyBankName: companiesTable.bankName,
        companyBankAccountNumber: companiesTable.bankAccountNumber,
        companyBankAccountHolder: companiesTable.bankAccountHolder,
        companyBankSwiftCode: companiesTable.bankSwiftCode,
        letterheadImage: companiesTable.letterheadImage,
        signatoryName: companiesTable.signatoryName,
        signatoryDesignation: companiesTable.signatoryDesignation,
        signatureImage: companiesTable.signatureImage,
        clientId: billingDocumentsTable.clientId,
        customerName: billingDocumentsTable.customerName,
        customerAddress: billingDocumentsTable.customerAddress,
        customerTin: billingDocumentsTable.customerTin,
        issueDate: billingDocumentsTable.issueDate,
        dueDate: billingDocumentsTable.dueDate,
        terms: billingDocumentsTable.terms,
        gstRate: billingDocumentsTable.gstRate,
        gstInclusive: billingDocumentsTable.gstInclusive,
        notes: billingDocumentsTable.notes,
        status: billingDocumentsTable.status,
        createdAt: billingDocumentsTable.createdAt,
      })
      .from(billingDocumentsTable)
      .innerJoin(companiesTable, eq(billingDocumentsTable.companyId, companiesTable.id))
      .leftJoin(clientsTable, eq(billingDocumentsTable.clientId, clientsTable.id))
      .where(eq(billingDocumentsTable.id, id))
      .limit(1),
    db
      .select()
      .from(billingItemsTable)
      .where(eq(billingItemsTable.documentId, id))
      .orderBy(billingItemsTable.position, billingItemsTable.id),
    db.select().from(appSettingsTable).limit(1),
  ]);

  if (docRows.length === 0) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const settings = settingsRows[0];
  res.json({
    ...docRows[0],
    items,
    systemLogoImage: settings?.logoImage ?? null,
    systemAddress: settings?.companyAddress ?? null,
    systemPhone: settings?.companyPhone ?? null,
    systemEmail: settings?.companyEmail ?? null,
  });
});

export default router;
