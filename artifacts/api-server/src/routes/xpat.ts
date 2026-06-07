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
 * GET /xpat/photo?photoId=<id>&serviceId=<id>
 * Proxies the employee photo (JPEG) from the Xpat GetImage endpoint.
 * Accepts only the two opaque IDs (not a caller-supplied URL) so the
 * backend constructs the target URL itself — eliminating any SSRF risk.
 * Both params are validated to contain only safe word characters.
 */
router.get("/xpat/photo", requireAuth, async (req, res): Promise<void> => {
  const { photoId, serviceId } = req.query;
  if (!photoId || !serviceId || typeof photoId !== "string" || typeof serviceId !== "string") {
    res.status(400).json({ error: "photoId and serviceId are required" });
    return;
  }
  // Allow only alphanumeric / dash / underscore to prevent injection.
  if (!/^[\w-]+$/.test(photoId) || !/^[\w-]+$/.test(serviceId)) {
    res.status(400).json({ error: "Invalid photoId or serviceId" });
    return;
  }
  const url = `${XPAT_BASE}/WorkPermit/GetImage?photoId=${encodeURIComponent(photoId)}&serviceId=${encodeURIComponent(serviceId)}`;
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
