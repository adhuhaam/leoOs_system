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

/** Allowed host and path prefix for Xpat photo URLs — prevents SSRF. */
const XPAT_PHOTO_HOST = "mobile-xpat.egov.mv";
const XPAT_PHOTO_PATH = "/api/v1/WorkPermit/GetImage";

/**
 * GET /xpat/photo?photoUrl=<encoded-xpat-url>
 * Proxies the employee photo (JPEG) from the Xpat API.
 * Accepts the full photoUrl returned by the work-permit endpoint and
 * validates it is from the known Xpat host before forwarding, so the
 * API key is never sent to an attacker-controlled domain (no SSRF risk).
 */
router.get("/xpat/photo", requireAuth, async (req, res): Promise<void> => {
  const { photoUrl } = req.query;
  if (!photoUrl || typeof photoUrl !== "string") {
    res.status(400).json({ error: "photoUrl is required" });
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(photoUrl);
  } catch {
    res.status(400).json({ error: "Invalid photoUrl" });
    return;
  }
  if (parsed.hostname !== XPAT_PHOTO_HOST || !parsed.pathname.startsWith(XPAT_PHOTO_PATH)) {
    res.status(400).json({ error: "photoUrl host or path not allowed" });
    return;
  }
  const url = photoUrl; // validated above
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
