# LEO OS

An AI-powered passport data extraction tool for Bangladesh and Indian passports. Upload passport images or PDFs and the system automatically extracts name, passport number, dates, address, and nationality using GPT vision OCR.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/passport-ocr run dev` — run the web frontend (port varies)
- `pnpm --filter @workspace/passport-ocr-admin run dev` — run the LEO ADMIN mobile app (Expo Go)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI via Replit AI Integrations
- Required secret: `SUPERUSER_EMAIL` — email for the auto-seeded superuser account (first boot)
- Required secret: `SUPERUSER_PASSWORD` — password for the auto-seeded superuser account (first boot)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- OCR: OpenAI GPT vision (via Replit AI Integrations, no API key needed)
- File uploads: multer (memory storage)
- PDF-to-image: pdf2pic + sharp
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/passports.ts` — Passport table schema
- `artifacts/api-server/src/routes/passports.ts` — Passport CRUD + upload routes
- `artifacts/api-server/src/lib/ocr.ts` — OpenAI vision OCR extraction logic
- `artifacts/passport-ocr/src/` — React frontend (pages, components)
- `artifacts/passport-ocr-admin/app/` — LEO ADMIN mobile app (file-based routes)
- `artifacts/passport-ocr-admin/lib/auth.tsx` — RBAC auth provider (login, register, loginWithGoogle, exposes user.role)
- `lib/db/src/schema/users.ts` — users table (id, email, name, role, googleId, isApproved, passwordHash, linkedEntityId)
- `artifacts/api-server/src/routes/auth.ts` — email+password login, Google OAuth, register, requireAuth/requireRole
- `artifacts/api-server/src/routes/admin-users.ts` — admin user CRUD (superuser+admin only)
- `artifacts/api-server/src/lib/bootstrap-users.ts` — ensures users table exists, seeds superuser on first boot
- `artifacts/passport-ocr-admin/app/admin/users.tsx` — User Management screen (mobile)
- `artifacts/passport-ocr-admin/app/admin/system-settings.tsx` — System Settings / Google OAuth screen (mobile, superuser)
- `artifacts/passport-ocr/src/pages/users.tsx` — User Management page (web, admin+superuser)

## Auth & RBAC

- **Roles**: superuser > admin > client > company > employee > agent
- **Self-registration**: `POST /auth/register` creates an unapproved account; admin/superuser approves via User Management
- **Login**: `POST /auth/login` with `{email, password}`; returns 403 if account not yet approved
- **Google Sign-In** (mobile): configure Web/Android + iOS client IDs in System Settings → backend verifies the ID token via `google-auth-library`
- **Superuser seed**: on first boot the server reads `SUPERUSER_EMAIL` + `SUPERUSER_PASSWORD` env secrets and inserts the superuser row (idempotent; skipped if a superuser already exists)
- **Role-aware nav**: web sidebar hides User Management unless role is admin/superuser; mobile tabs hide based on role

## Architecture decisions

- OCR is processed asynchronously: upload returns a `processing` record immediately, then OCR runs in background and updates to `completed`/`failed`
- File uploads use multer memory storage (no disk writes); PDF pages converted to JPEG via pdf2pic before sending to GPT vision
- Images are resized to max 1600x1200 via sharp before OCR to reduce token usage
- `api-zod` tsconfig includes DOM lib to support File/Blob types generated from multipart spec

## Product

Users upload passport images (JPG, PNG, PDF) for Bangladesh and Indian passports. The app extracts: full name, passport number, date of birth, date of issue, date of expiry, address, and nationality. Extracted records are stored in PostgreSQL and displayed in a CRUD dashboard with search, filter, edit, and delete capabilities.

## LEO ADMIN mobile app

The `passport-ocr-admin` artifact is the LEO ADMIN Expo (React Native) app. It connects to the same `/api` endpoints and uses Bearer token auth. It exposes all admin features including User Management and System Settings.

### Run locally
- `pnpm --filter @workspace/passport-ocr-admin run dev` — starts Metro/Expo. Open in Expo Go on a device on the same network, or scan the QR.
- The app reads `EXPO_PUBLIC_DOMAIN` and points API calls at `https://${EXPO_PUBLIC_DOMAIN}`.

### Build an Android APK / AAB (EAS)
The repo includes `artifacts/passport-ocr-admin/eas.json` pre-configured with:
- Android package: `com.leo.os` (set in `app.json` — never change after publishing to Play)
- Backend domain: `EXPO_PUBLIC_DOMAIN=leomaldives.com` (used by the built app for all API/auth calls)

One-time setup:
1. Install the CLI: `npm i -g eas-cli`
2. `cd artifacts/passport-ocr-admin && eas login` (free Expo account)
3. `eas init` — links the project to your Expo account and writes `extra.eas.projectId` into `app.json`. Commit that change.

Preview build (side-loadable APK):
```bash
cd artifacts/passport-ocr-admin
eas build -p android --profile preview
```
EAS returns a downloadable `.apk` URL (~10–15 min). Install on any Android device and sign in.

Production build (Play Store AAB):
```bash
cd artifacts/passport-ocr-admin
eas build -p android --profile production
```
Returns a `.aab` for upload to Google Play Console.

If keystore generation prompts on first build, accept the EAS-managed keystore — re-use the same one for all future builds so updates install cleanly.

### Build an iOS .ipa (EAS)
The same `eas.json` already includes an `ios` block on both profiles:
- iOS bundle identifier: `com.leo.os` (set in `app.json`, matches the Android package)
- `preview` uses `distribution: "internal"` for ad-hoc provisioning
- `production` is for App Store submission via TestFlight / `eas submit`

Requirements:
- A paid Apple Developer Program membership ($99/year)
- Your iPhone's UDID registered with EAS

One-time iPhone registration:
```bash
cd artifacts/passport-ocr-admin
eas device:create
```

Preview build (installable .ipa):
```bash
cd artifacts/passport-ocr-admin
eas build -p ios --profile preview
```

Production build (App Store submission):
```bash
cd artifacts/passport-ocr-admin
eas build -p ios --profile production
eas submit -p ios --latest
```

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change
- After adding new users or changing roles, the session is already role-aware — no server restart needed
- Google OAuth client IDs are stored in the `app_settings` table (via System Settings screen), NOT in env vars
- `sharp` requires native build approval: run `pnpm approve-builds` and select sharp if PDF conversion fails
- Always run `pnpm --filter @workspace/db run push` after schema changes
- OCR uses `gpt-5.4` model with vision — requires `AI_INTEGRATIONS_OPENAI_BASE_URL` env var

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
