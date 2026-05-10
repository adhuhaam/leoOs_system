// Microsoft OneDrive (Graph) helper.
//
// Tokens come from the Replit OneDrive connector
// (connection:conn_onedrive_01KR9QQK2JQFKDHKJFNGFNBQH2). Never cache the
// access token across requests — it expires and the connectors proxy
// returns a refreshed one.
//
// All routes are jailed to ROOT_FOLDER_PATH so callers can only browse
// inside that folder regardless of any path they pass in.

import type { Response } from "express";

export const ROOT_FOLDER_PATH = "data";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class OneDriveNotConnectedError extends Error {
  constructor(message = "OneDrive is not connected") {
    super(message);
    this.name = "OneDriveNotConnectedError";
  }
}

export class OneDriveNotFoundError extends Error {
  constructor(message = "Item not found") {
    super(message);
    this.name = "OneDriveNotFoundError";
  }
}

export class OneDriveBadPathError extends Error {
  constructor(message = "Invalid path") {
    super(message);
    this.name = "OneDriveBadPathError";
  }
}

// Always fetch a fresh token from the connectors proxy. The proxy itself
// returns a still-valid (refreshed) token for each call, so caching here
// would risk handing out a stale or revoked one across requests.
export async function getOneDriveAccessToken(): Promise<string> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const replIdentity = process.env["REPL_IDENTITY"];
  const webReplRenewal = process.env["WEB_REPL_RENEWAL"];
  const xReplitToken = replIdentity
    ? "repl " + replIdentity
    : webReplRenewal
      ? "depl " + webReplRenewal
      : null;

  if (!hostname || !xReplitToken) {
    throw new OneDriveNotConnectedError(
      "Replit connectors not available in this environment",
    );
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=onedrive`,
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } },
  );
  if (!res.ok) {
    throw new OneDriveNotConnectedError(
      `Connectors proxy returned ${res.status}`,
    );
  }
  const data = (await res.json()) as {
    items?: Array<{
      settings?: {
        access_token?: string;
        expires_at?: string;
        oauth?: { credentials?: { access_token?: string; expires_at?: string } };
      };
    }>;
  };
  const item = data.items?.[0];
  const accessToken =
    item?.settings?.access_token ??
    item?.settings?.oauth?.credentials?.access_token;

  if (!accessToken) {
    throw new OneDriveNotConnectedError();
  }
  return accessToken;
}

// ──────────────────────────────────────────────────────────────────────────
// Path validation + URL building
// ──────────────────────────────────────────────────────────────────────────

/** Validate the client-supplied subPath (relative to ROOT_FOLDER_PATH).
 *  Rejects empty segments, `.`, `..`, backslashes, control chars. */
export function validateSubPath(input: unknown): string {
  if (input == null || input === "") return "";
  if (typeof input !== "string") {
    throw new OneDriveBadPathError("path must be a string");
  }
  if (input.length > 1024) {
    throw new OneDriveBadPathError("path too long");
  }
  // Strip leading / trailing slashes; reject backslashes outright.
  if (input.includes("\\")) {
    throw new OneDriveBadPathError("backslash not allowed in path");
  }
  const trimmed = input.replace(/^\/+|\/+$/g, "");
  if (trimmed === "") return "";
  const segments = trimmed.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new OneDriveBadPathError("invalid path segment");
    }
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f]/.test(seg)) {
      throw new OneDriveBadPathError("control characters not allowed in path");
    }
  }
  return segments.join("/");
}

/** Build the Graph "by path" URL relative to the configured root folder.
 *  e.g. subPath="2026/Bookings" → /me/drive/root:/data/2026/Bookings */
function graphRootPathPrefix(subPath: string): string {
  const segments = [ROOT_FOLDER_PATH, ...(subPath ? subPath.split("/") : [])];
  // encodeURIComponent on each segment (Graph's by-path syntax tolerates
  // %-encoded values; bare slashes separate segments).
  const encoded = segments.map((s) => encodeURIComponent(s)).join("/");
  return `/me/drive/root:/${encoded}`;
}

async function graph(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

// ──────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────

export type FileItem = {
  id: string;
  name: string;
  path: string; // root-relative, no leading slash
  isFolder: boolean;
  size: number | null;
  lastModifiedAt: string;
  mimeType: string | null;
  webUrl: string;
};

export type Breadcrumb = { name: string; path: string };

export type FileDetail = FileItem & {
  previewKind: "image" | "pdf" | "text" | "office" | "video" | "audio" | "other";
  hasThumbnail: boolean;
};

type GraphDriveItem = {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
};

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function toFileItem(node: GraphDriveItem, parentSubPath: string): FileItem {
  const isFolder = !!node.folder;
  return {
    id: node.id,
    name: node.name,
    path: joinPath(parentSubPath, node.name),
    isFolder,
    size: isFolder ? null : (node.size ?? 0),
    lastModifiedAt: node.lastModifiedDateTime ?? new Date(0).toISOString(),
    mimeType: node.file?.mimeType ?? null,
    webUrl: node.webUrl ?? "",
  };
}

function previewKindFor(name: string, mime: string | null): FileDetail["previewKind"] {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime?.startsWith("video/") || ["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  if (mime?.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  if (
    ["docx", "doc", "xlsx", "xls", "pptx", "ppt"].includes(ext)
  ) return "office";
  if (
    mime?.startsWith("text/") ||
    ["txt", "md", "csv", "json", "yaml", "yml", "xml", "html", "css", "js", "ts", "tsx", "jsx", "log"].includes(ext)
  ) {
    return "text";
  }
  return "other";
}

// ──────────────────────────────────────────────────────────────────────────
// Operations
// ──────────────────────────────────────────────────────────────────────────

export async function isConnected(): Promise<boolean> {
  try {
    await getOneDriveAccessToken();
    return true;
  } catch {
    return false;
  }
}

export async function listFolder(args: {
  subPath: string;
  top?: number;
  cursor?: string | null;
}): Promise<{ items: FileItem[]; breadcrumbs: Breadcrumb[]; nextCursor: string | null }> {
  const { subPath, cursor } = args;
  const top = Math.min(Math.max(args.top ?? 200, 1), 999);

  const token = await getOneDriveAccessToken();
  let url: string;
  if (cursor) {
    // The opaque @odata.nextLink supplied by Graph — already absolute.
    url = cursor;
  } else {
    const prefix = graphRootPathPrefix(subPath);
    const select = "id,name,size,lastModifiedDateTime,file,folder,webUrl";
    url = `${GRAPH_BASE}${prefix}:/children?$select=${encodeURIComponent(select)}&$top=${top}&$orderby=name`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    throw new OneDriveNotFoundError();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph list error ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    value: GraphDriveItem[];
    "@odata.nextLink"?: string;
  };
  const items = body.value.map((n) => toFileItem(n, subPath));
  items.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const breadcrumbs = buildBreadcrumbs(subPath);
  return { items, breadcrumbs, nextCursor: body["@odata.nextLink"] ?? null };
}

function buildBreadcrumbs(subPath: string): Breadcrumb[] {
  const trail: Breadcrumb[] = [{ name: "Files", path: "" }];
  if (!subPath) return trail;
  const segs = subPath.split("/");
  let acc = "";
  for (const s of segs) {
    acc = acc ? `${acc}/${s}` : s;
    trail.push({ name: s, path: acc });
  }
  return trail;
}

export async function getItem(subPath: string): Promise<FileDetail> {
  if (!subPath) {
    // Root folder details — synthesize.
    return {
      id: "root",
      name: ROOT_FOLDER_PATH,
      path: "",
      isFolder: true,
      size: null,
      lastModifiedAt: new Date().toISOString(),
      mimeType: null,
      webUrl: "",
      previewKind: "other",
      hasThumbnail: false,
    };
  }
  const token = await getOneDriveAccessToken();
  const prefix = graphRootPathPrefix(subPath);
  const res = await graph(token, `${prefix}?$select=id,name,size,lastModifiedDateTime,file,folder,webUrl`);
  if (res.status === 404) throw new OneDriveNotFoundError();
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Graph item error ${res.status}: ${t.slice(0, 200)}`);
  }
  const node = (await res.json()) as GraphDriveItem;
  const parentSub = subPath.includes("/") ? subPath.slice(0, subPath.lastIndexOf("/")) : "";
  const base = toFileItem(node, parentSub);
  const previewKind = base.isFolder ? "other" : previewKindFor(base.name, base.mimeType);
  return { ...base, previewKind, hasThumbnail: !base.isFolder && previewKind !== "other" && previewKind !== "text" };
}

/** Stream the file bytes through to the Express response.
 *  Does not buffer the whole body in memory and aborts the upstream
 *  fetch if the client disconnects before the transfer completes. */
export async function streamItem(args: {
  subPath: string;
  res: Response;
  disposition: "inline" | "attachment";
  filename: string;
}): Promise<void> {
  const { subPath, res, disposition, filename } = args;
  const token = await getOneDriveAccessToken();
  const prefix = graphRootPathPrefix(subPath);
  const ac = new AbortController();
  res.on("close", () => ac.abort());
  const upstream = await graph(token, `${prefix}:/content`, {
    redirect: "follow",
    signal: ac.signal,
  });
  if (upstream.status === 404) throw new OneDriveNotFoundError();
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => "");
    throw new Error(`Graph download error ${upstream.status}: ${t.slice(0, 200)}`);
  }
  const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
  const len = upstream.headers.get("content-length");
  res.setHeader("Content-Type", ct);
  if (len) res.setHeader("Content-Length", len);
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${encodeURIComponent(filename)}"`,
  );

  await pipeWebStreamToResponse(upstream.body, res, ac);
}

async function pipeWebStreamToResponse(
  body: ReadableStream<Uint8Array>,
  res: Response,
  ac: AbortController,
): Promise<void> {
  const { Readable } = await import("node:stream");
  const nodeStream = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  const cleanup = () => {
    ac.abort();
    if (!nodeStream.destroyed) nodeStream.destroy();
  };
  res.once("close", cleanup);
  nodeStream.pipe(res);
  await new Promise<void>((resolve, reject) => {
    nodeStream.on("end", () => resolve());
    nodeStream.on("error", (err) => {
      cleanup();
      // Aborts after client disconnect are expected; don't surface them.
      if (ac.signal.aborted) resolve();
      else reject(err);
    });
    res.on("close", () => resolve());
  });
}

export async function streamThumbnail(args: {
  subPath: string;
  size: "small" | "medium" | "large";
  res: Response;
}): Promise<void> {
  const { subPath, size, res } = args;
  if (!subPath) throw new OneDriveBadPathError("thumbnail requires a path");
  const token = await getOneDriveAccessToken();
  const prefix = graphRootPathPrefix(subPath);
  // Get the thumbnail URL first, then redirect-follow to bytes via :/content.
  const meta = await graph(token, `${prefix}:/thumbnails/0/${size}`);
  if (meta.status === 404) throw new OneDriveNotFoundError();
  if (!meta.ok) {
    const t = await meta.text().catch(() => "");
    throw new Error(`Graph thumbnail meta ${meta.status}: ${t.slice(0, 200)}`);
  }
  const metaJson = (await meta.json()) as { url?: string };
  if (!metaJson.url) throw new OneDriveNotFoundError("no thumbnail available");

  const ac = new AbortController();
  res.on("close", () => ac.abort());
  const upstream = await fetch(metaJson.url, { signal: ac.signal });
  if (!upstream.ok || !upstream.body) {
    throw new Error(`Thumbnail bytes error ${upstream.status}`);
  }
  res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=300");
  await pipeWebStreamToResponse(upstream.body, res, ac);
}
