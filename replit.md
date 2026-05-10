# Passport OCR Dashboard

An AI-powered passport data extraction tool for Bangladesh and Indian passports. Upload passport images or PDFs and the system automatically extracts name, passport number, dates, address, and nationality using GPT vision OCR.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/passport-ocr run dev` — run the web frontend (port varies)
- `pnpm --filter @workspace/passport-ocr-mobile run dev` — run the Expo mobile app (Expo Go)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI via Replit AI Integrations

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
- `artifacts/passport-ocr-mobile/app/` — Expo mobile app (file-based routes; tabs: Dashboard, Master, Capture, Billing, More)
- `artifacts/passport-ocr-mobile/lib/auth.tsx` — shared-password auth provider (cookie session, native persistence)

## Architecture decisions

- OCR is processed asynchronously: upload returns a `processing` record immediately, then OCR runs in background and updates to `completed`/`failed`
- File uploads use multer memory storage (no disk writes); PDF pages converted to JPEG via pdf2pic before sending to GPT vision
- Images are resized to max 1600x1200 via sharp before OCR to reduce token usage
- `api-zod` tsconfig includes DOM lib to support File/Blob types generated from multipart spec

## Product

Users upload passport images (JPG, PNG, PDF) for Bangladesh and Indian passports. The app extracts: full name, passport number, date of birth, date of issue, date of expiry, address, and nationality. Extracted records are stored in PostgreSQL and displayed in a CRUD dashboard with search, filter, edit, and delete capabilities.

## Mobile app

The `passport-ocr-mobile` artifact is an Expo (React Native) client that reuses the same `/api` endpoints as the web dashboard. It signs in with the same shared password, persists the session cookie natively, and exposes:

- **Dashboard** — passport stats, quick actions, recent uploads
- **Master** — passport list with status/nationality filters and the latest-LOA company per candidate
- **Capture** — camera + document picker upload to `/api/passports/upload` (multipart; field `file`)
- **Billing** — invoices and quotations (view-only); detail view shows line items + GST totals
- **More** — Clients (view-only), Expenses (CRUD), and Sign-out

### Run locally
- `pnpm --filter @workspace/passport-ocr-mobile run dev` — starts Metro/Expo. Open in Expo Go on a device on the same network, or scan the QR.
- The app reads `EXPO_PUBLIC_DOMAIN` (set by the workflow) and points API calls at `https://${EXPO_PUBLIC_DOMAIN}` so it shares the proxied `/api` with the web app.

### Build an Android APK / AAB (EAS)
The repo includes `artifacts/passport-ocr-mobile/eas.json` pre-configured with:
- Android package: `com.leo.os` (set in `app.json` — never change after publishing to Play)
- Backend domain: `EXPO_PUBLIC_DOMAIN=leomaldives.com` (used by the built app for all API/auth calls)

One-time setup:
1. Install the CLI: `npm i -g eas-cli`
2. `cd artifacts/passport-ocr-mobile && eas login` (free Expo account)
3. `eas init` — links the project to your Expo account and writes `extra.eas.projectId` into `app.json`. Commit that change.

Preview build (side-loadable APK):
```bash
cd artifacts/passport-ocr-mobile
eas build -p android --profile preview
```
EAS returns a downloadable `.apk` URL (~10–15 min). Install on any Android device and sign in with the shared password.

Production build (Play Store AAB):
```bash
cd artifacts/passport-ocr-mobile
eas build -p android --profile production
```
Returns a `.aab` for upload to Google Play Console.

If keystore generation prompts on first build, accept the EAS-managed keystore — re-use the same one for all future builds so updates install cleanly.

### Build an iOS .ipa (EAS)
The same `eas.json` already includes an `ios` block on both profiles:
- iOS bundle identifier: `com.leo.os` (set in `app.json`, matches the Android package)
- `preview` uses `distribution: "internal"` so the build is signed with an
  ad-hoc provisioning profile and installs on iPhones whose UDIDs are
  registered with your Expo / Apple Developer account
- `production` is for App Store submission via TestFlight / `eas submit`

Requirements:
- A paid Apple Developer Program membership ($99/year) — Apple will not let
  you install a `.ipa` on a real iPhone without one
- Your iPhone's UDID registered with EAS (see step 1 below)

One-time iPhone registration:
```bash
cd artifacts/passport-ocr-mobile
eas device:create
```
This prints a QR code / link. Open the link on your iPhone in **Safari** and
approve the device profile that downloads. Then go to
*Settings → General → VPN & Device Management* → tap the new profile →
*Install*. Your phone is now registered for ad-hoc builds.

Preview build (installable .ipa):
```bash
cd artifacts/passport-ocr-mobile
eas build -p ios --profile preview
```
First run prompts for your Apple ID; EAS auto-creates the distribution
certificate and provisioning profile (always pick the EAS-managed option
so future builds reuse the same credentials). Build takes ~15–20 min.

When the build finishes, EAS emails a link / QR. Open it on your registered
iPhone in **Safari** → tap *Install*. After install, *Settings → General →
VPN & Device Management* → tap the developer profile → *Trust*. The app then
launches normally.

Production build (App Store submission):
```bash
cd artifacts/passport-ocr-mobile
eas build -p ios --profile production
eas submit -p ios --latest
```
The first command produces a store-signed build; the second uploads it to
App Store Connect for TestFlight / review.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change
- `sharp` requires native build approval: run `pnpm approve-builds` and select sharp if PDF conversion fails
- Always run `pnpm --filter @workspace/db run push` after schema changes
- OCR uses `gpt-5.4` model with vision — requires `AI_INTEGRATIONS_OPENAI_BASE_URL` env var

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
