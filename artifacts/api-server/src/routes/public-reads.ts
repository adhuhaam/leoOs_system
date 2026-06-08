import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, loaTable, companiesTable } from "@workspace/db";

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

export default router;
