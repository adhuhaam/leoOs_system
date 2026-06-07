import type { Request, Response, NextFunction } from "express";
import { db, rolePermissionsTable } from "@workspace/db";

type Action = "view" | "edit" | "delete";
interface PermEntry { canView: boolean; canEdit: boolean; canDelete: boolean }

let _cache: Map<string, PermEntry> | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 60_000;

export async function getPermissionsCache(): Promise<Map<string, PermEntry>> {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL_MS) return _cache;
  const rows = await db.select().from(rolePermissionsTable);
  const m = new Map<string, PermEntry>();
  for (const row of rows) {
    m.set(`${row.role}:${row.module}`, {
      canView: row.canView,
      canEdit: row.canEdit,
      canDelete: row.canDelete,
    });
  }
  _cache = m;
  _cacheTs = now;
  return m;
}

export function invalidatePermissionsCache(): void {
  _cache = null;
}

function getModuleAction(method: string, path: string): { module: string; action: Action } | null {
  const m = method.toUpperCase();
  const p = path.replace(/\?.*$/, "");

  // Upload first (more specific than generic passport pattern)
  if (/^\/passports\/upload$/.test(p) && m === "POST") return { module: "upload", action: "edit" };

  // Passports / masterlist
  if (/^\/passports(\/\d+|\/stats)?$/.test(p) && m === "GET") return { module: "masterlist", action: "view" };
  if (/^\/passports\/\d+$/.test(p) && m === "PATCH") return { module: "masterlist", action: "edit" };
  if (/^\/passports\/\d+$/.test(p) && m === "DELETE") return { module: "masterlist", action: "delete" };

  // Companies
  if (/^\/companies(\/\d+)?$/.test(p) && m === "GET") return { module: "companies", action: "view" };
  if (/^\/companies$/.test(p) && m === "POST") return { module: "companies", action: "edit" };
  if (/^\/companies\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "companies", action: "edit" };
  if (/^\/companies\/\d+$/.test(p) && m === "DELETE") return { module: "companies", action: "delete" };

  // Clients
  if (/^\/clients(\/\d+)?$/.test(p) && m === "GET") return { module: "clients", action: "view" };
  if (/^\/clients$/.test(p) && m === "POST") return { module: "clients", action: "edit" };
  if (/^\/clients\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "clients", action: "edit" };
  if (/^\/clients\/\d+$/.test(p) && m === "DELETE") return { module: "clients", action: "delete" };

  // LOA
  if (/^\/loa(\/\d+)?$/.test(p) && m === "GET") return { module: "loa", action: "view" };
  if (/^\/loa$/.test(p) && m === "POST") return { module: "loa", action: "edit" };
  if (/^\/loa\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "loa", action: "edit" };
  if (/^\/loa\/\d+$/.test(p) && m === "DELETE") return { module: "loa", action: "delete" };

  // Billing
  if (/^\/billing(\/\d+)?$/.test(p) && m === "GET") return { module: "billing", action: "view" };
  if (/^\/billing$/.test(p) && m === "POST") return { module: "billing", action: "edit" };
  if (/^\/billing\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "billing", action: "edit" };
  if (/^\/billing\/\d+$/.test(p) && m === "DELETE") return { module: "billing", action: "delete" };

  // Expenses
  if (/^\/expenses(\/\d+)?$/.test(p) && m === "GET") return { module: "expenses", action: "view" };
  if (/^\/expenses$/.test(p) && m === "POST") return { module: "expenses", action: "edit" };
  if (/^\/expenses\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "expenses", action: "edit" };
  if (/^\/expenses\/\d+$/.test(p) && m === "DELETE") return { module: "expenses", action: "delete" };

  // Passwords
  if (/^\/passwords(\/\d+)?$/.test(p) && m === "GET") return { module: "passwords", action: "view" };
  if (/^\/passwords$/.test(p) && m === "POST") return { module: "passwords", action: "edit" };
  if (/^\/passwords\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "passwords", action: "edit" };
  if (/^\/passwords\/\d+$/.test(p) && m === "DELETE") return { module: "passwords", action: "delete" };

  return null;
}

export async function permissionsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const role = req.session?.role;
  // Skip: unauthenticated requests, superuser and admin (handled by existing RBAC)
  if (!role || role === "superuser" || role === "admin") {
    next();
    return;
  }

  const target = getModuleAction(req.method, req.path);
  if (!target) {
    next();
    return;
  }

  try {
    const cache = await getPermissionsCache();
    const perm = cache.get(`${role}:${target.module}`);
    const allowed =
      target.action === "view"
        ? (perm?.canView ?? false)
        : target.action === "edit"
          ? (perm?.canEdit ?? false)
          : (perm?.canDelete ?? false);

    if (!allowed) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } catch {
    // If DB unavailable, fail open — do not block the request
  }

  next();
}
