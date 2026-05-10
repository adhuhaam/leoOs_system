import { Router, type IRouter } from "express";
import {
  OneDriveBadPathError,
  OneDriveNotConnectedError,
  OneDriveNotFoundError,
  getItem,
  isConnected,
  listFolder,
  streamItem,
  streamThumbnail,
  validateSubPath,
} from "../lib/onedrive";

const router: IRouter = Router();

function basenameOf(p: string, fallback = "file"): string {
  if (!p) return fallback;
  const last = p.split("/").pop();
  return last && last.length > 0 ? last : fallback;
}

router.get("/files/status", async (req, res) => {
  const connected = await isConnected();
  req.log.info({ connected }, "files: status");
  res.json({ connected });
});

router.get("/files/list", async (req, res) => {
  let subPath = "";
  try {
    subPath = validateSubPath(req.query["path"]);
  } catch (err) {
    if (err instanceof OneDriveBadPathError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  const limitRaw = Number(req.query["limit"] ?? 200);
  const cursor = typeof req.query["cursor"] === "string" ? req.query["cursor"] : null;

  try {
    const result = await listFolder({
      subPath,
      top: Number.isFinite(limitRaw) ? limitRaw : 200,
      cursor,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof OneDriveNotConnectedError) {
      res.status(503).json({ error: "OneDrive is not connected" });
      return;
    }
    if (err instanceof OneDriveNotFoundError) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    req.log.error({ err }, "files: list failed");
    res.status(502).json({ error: "OneDrive request failed" });
  }
});

router.get("/files/item", async (req, res) => {
  let subPath = "";
  try {
    subPath = validateSubPath(req.query["path"]);
  } catch (err) {
    if (err instanceof OneDriveBadPathError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  try {
    const detail = await getItem(subPath);
    res.json(detail);
  } catch (err) {
    if (err instanceof OneDriveNotConnectedError) {
      res.status(503).json({ error: "OneDrive is not connected" });
      return;
    }
    if (err instanceof OneDriveNotFoundError) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    req.log.error({ err }, "files: item failed");
    res.status(502).json({ error: "OneDrive request failed" });
  }
});

router.get("/files/thumbnail", async (req, res) => {
  let subPath = "";
  try {
    subPath = validateSubPath(req.query["path"]);
  } catch (err) {
    if (err instanceof OneDriveBadPathError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  const sizeRaw = String(req.query["size"] ?? "medium");
  const size: "small" | "medium" | "large" =
    sizeRaw === "small" || sizeRaw === "large" ? sizeRaw : "medium";

  try {
    await streamThumbnail({ subPath, size, res });
  } catch (err) {
    if (res.headersSent) return;
    if (err instanceof OneDriveNotConnectedError) {
      res.status(503).json({ error: "OneDrive is not connected" });
      return;
    }
    if (err instanceof OneDriveNotFoundError) {
      res.status(404).json({ error: "Thumbnail not available" });
      return;
    }
    req.log.error({ err }, "files: thumbnail failed");
    res.status(502).json({ error: "OneDrive thumbnail failed" });
  }
});

async function streamWithDisposition(
  reqPath: unknown,
  disposition: "inline" | "attachment",
  res: Parameters<typeof streamItem>[0]["res"],
  log: (err: unknown) => void,
) {
  let subPath = "";
  try {
    subPath = validateSubPath(reqPath);
  } catch (err) {
    if (err instanceof OneDriveBadPathError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  if (!subPath) {
    res.status(400).json({ error: "path required" });
    return;
  }
  try {
    await streamItem({
      subPath,
      res,
      disposition,
      filename: basenameOf(subPath),
    });
  } catch (err) {
    if (res.headersSent) return;
    if (err instanceof OneDriveNotConnectedError) {
      res.status(503).json({ error: "OneDrive is not connected" });
      return;
    }
    if (err instanceof OneDriveNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    log(err);
    res.status(502).json({ error: "OneDrive download failed" });
  }
}

router.get("/files/download", async (req, res) => {
  await streamWithDisposition(req.query["path"], "attachment", res, (err) =>
    req.log.error({ err }, "files: download failed"),
  );
});

router.get("/files/preview", async (req, res) => {
  await streamWithDisposition(req.query["path"], "inline", res, (err) =>
    req.log.error({ err }, "files: preview failed"),
  );
});

export default router;
