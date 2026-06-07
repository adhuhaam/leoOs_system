---
name: RBAC auth system
description: Multi-role user auth with email/password, Google OAuth, approval gate, and role-aware nav on web and mobile.
---

# RBAC Auth System

## The rule
The app uses a 6-role hierarchy: superuser > admin > client > company > employee > agent. All auth is session-based (express-session). The old shared-password system is gone.

**Why:** Business requirement — multiple user types with different access levels needed.

## How to apply
- Backend middleware: `requireAuth` (any session) and `requireRole(...roles)` (role check) in `artifacts/api-server/src/routes/auth.ts`
- Admin user CRUD is behind `requireRole("superuser", "admin")` in `routes/index.ts`
- Google OAuth keys stored in `app_settings` table columns (`googleClientId`, `googleClientSecret`, `googleClientIdIos`), not env vars
- Superuser is seeded on first boot via `SUPERUSER_EMAIL` + `SUPERUSER_PASSWORD` env secrets (idempotent — skips if superuser row already exists)
- Mobile `useAuth()` exposes `{ user: { id, name, email, role } }` — use `role` to gate UI
- Web sidebar reads role from `/auth/me` response via `useGetAuthStatus` hook and filters `ALL_NAV_ITEMS` by `item.roles`
- Mobile tabs use `href: null` in `(tabs)/_layout.tsx` to hide tabs by role

## Key files
- `lib/db/src/schema/users.ts` — users table schema
- `artifacts/api-server/src/routes/auth.ts` — login, register, google, requireAuth, requireRole
- `artifacts/api-server/src/routes/admin-users.ts` — admin CRUD for users
- `artifacts/api-server/src/lib/bootstrap-users.ts` — table creation + superuser seed
- `artifacts/passport-ocr-mobile/lib/auth.tsx` — mobile AuthProvider
- `artifacts/passport-ocr-mobile/app/admin/users.tsx` — User Management (mobile)
- `artifacts/passport-ocr-mobile/app/admin/system-settings.tsx` — Google OAuth config (mobile, superuser only)
- `artifacts/passport-ocr/src/pages/users.tsx` — User Management (web)
- `artifacts/passport-ocr/src/components/layout/app-layout.tsx` — role-aware sidebar
