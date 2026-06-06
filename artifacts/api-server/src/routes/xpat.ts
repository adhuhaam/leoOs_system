import { Router, type IRouter } from "express";
import { requireAuth } from "./auth";

const router: IRouter = Router();

const XPAT_BASE = "https://mobile-xpat.egov.mv/api/v1";
const XPAT_API_KEY = "d110e2a8-5adc-4f7b-90a0-701b4fedf476";

function xpatHeaders(): Record<string, string> {
  return { ApiKey: XPAT_API_KEY, Accept: "application/json" };
}

/**
 * GET /xpat/work-permit?workPermitNumber=WP...&passportNumber=V...
 * Proxies the Xpat MV work permit JSON to the authenticated client.
 */
router.get("/xpat/work-permit", requireAuth, async (req, res): Promise<void> => {
  const { workPermitNumber, passportNumber } = req.query;
  if (!workPermitNumber || !passportNumber) {
    res.status(400).json({ error: "workPermitNumber and passportNumber are required" });
    return;
  }
  const url =
    `${XPAT_BASE}/WorkPermit?WorkPermitNumber=${encodeURIComponent(String(workPermitNumber))}` +
    `&PassportNumber=${encodeURIComponent(String(passportNumber))}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, { headers: xpatHeaders() });
  } catch (err) {
    req.log.error({ err }, "Xpat API unreachable");
    res.status(502).json({ error: "Xpat API unreachable" });
    return;
  }
  if (!upstream.ok) {
    req.log.warn({ status: upstream.status }, "Xpat API returned non-OK");
    res.status(upstream.status).json({ error: "Xpat API error" });
    return;
  }
  const data: unknown = await upstream.json();
  res.setHeader("Cache-Control", "public, max-age=900");
  res.json(data);
});

/**
 * GET /xpat/photo?photoUrl=<relative-or-absolute-url>
 * Proxies the employee photo (JPEG) from Xpat, so the API key never reaches the browser.
 * The photoUrl value comes from the XpatWorkPermit JSON response.
 */
router.get("/xpat/photo", requireAuth, async (req, res): Promise<void> => {
  const raw = req.query.photoUrl;
  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "photoUrl required" });
    return;
  }
  const url = raw.startsWith("http") ? raw : `${XPAT_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { ApiKey: XPAT_API_KEY, Accept: "image/jpeg,image/*" },
    });
  } catch (err) {
    req.log.error({ err }, "Xpat photo fetch failed");
    res.status(502).end();
    return;
  }
  if (!upstream.ok) {
    res.status(upstream.status).end();
    return;
  }
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
});

/**
 * GET /xpat/card?workPermitNumber=WP...&passportNumber=V...
 * Proxies the official work permit card image (PNG).
 */
router.get("/xpat/card", requireAuth, async (req, res): Promise<void> => {
  const { workPermitNumber, passportNumber } = req.query;
  if (!workPermitNumber || !passportNumber) {
    res.status(400).json({ error: "workPermitNumber and passportNumber are required" });
    return;
  }
  const url =
    `${XPAT_BASE}/WorkPermitCard/GetWorkPermitCard?WorkPermitNumber=${encodeURIComponent(String(workPermitNumber))}` +
    `&PassportNumber=${encodeURIComponent(String(passportNumber))}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { ApiKey: XPAT_API_KEY, Accept: "image/png,image/*" },
    });
  } catch (err) {
    req.log.error({ err }, "Xpat card fetch failed");
    res.status(502).end();
    return;
  }
  if (!upstream.ok) {
    res.status(upstream.status).end();
    return;
  }
  const contentType = upstream.headers.get("content-type") ?? "image/png";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
});

export default router;
