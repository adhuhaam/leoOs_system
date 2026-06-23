# LEO OS — Full Developer Guide

**Version:** 1.0 — June 2026  
**Stack:** Node.js 24 · TypeScript 5.9 · PostgreSQL · React · Expo (React Native) · pnpm workspaces

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Environment & Secrets](#3-environment--secrets)
4. [Database Schema](#4-database-schema)
5. [API Server](#5-api-server)
6. [Authentication & RBAC](#6-authentication--rbac)
7. [OCR Pipeline](#7-ocr-pipeline)
8. [Web Application](#8-web-application)
9. [Mobile Application (LEO ADMIN)](#9-mobile-application-leo-admin)
10. [Shared Libraries](#10-shared-libraries)
11. [OpenAPI Contract & Codegen](#11-openapi-contract--codegen)
12. [Billing System](#12-billing-system)
13. [LOA (Letter of Appointment)](#13-loa-letter-of-appointment)
14. [Salary & Payroll](#14-salary--payroll)
15. [Expenses](#15-expenses)
16. [Tasks](#16-tasks)
17. [Xpat Integration](#17-xpat-integration)
18. [Companies & Clients](#18-companies--clients)
19. [System Settings](#19-system-settings)
20. [Deployment](#20-deployment)
21. [Development Workflow](#21-development-workflow)
22. [Key Architectural Decisions](#22-key-architectural-decisions)

---

## 1. System Overview

LEO OS is a full-stack ERP and AI-powered OCR platform built for a recruitment and manpower agency operating in the Maldives. It handles the complete employee lifecycle — from passport scanning and OCR extraction through to billing, salary, LOA generation, and expense tracking.

**Two front-ends, one API:**

| Surface | Technology | URL / Access |
|---|---|---|
| Web Dashboard | React + Vite + shadcn/ui | `leomaldives.com/` |
| LEO ADMIN Mobile | Expo (React Native) | Expo Go or APK download |
| API Server | Express 5 | `leomaldives.com/api` |
| Database | PostgreSQL (Replit managed) | Via `DATABASE_URL` |

**Core capabilities:**

- Upload passport images or PDFs → GPT-4o Vision extracts all fields automatically
- Full CRUD for passports, companies, clients, billing, LOAs, salary records, expenses, tasks
- Multi-role access control (superuser → admin → client → company → employee → agent)
- Printable invoices, quotations, LOA documents, expense vouchers
- Xpat work-permit lookup (Maldives immigration portal proxy)
- Monthly salary and profitability reporting

---

## 2. Repository Structure

```
leo-os/
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── routes/      # All route handlers
│   │       ├── lib/         # OCR, crypto, logger, bootstrap
│   │       └── index.ts     # Entry point, middleware setup
│   ├── passport-ocr/        # React + Vite web dashboard
│   │   └── src/
│   │       ├── pages/       # Page components (one per route)
│   │       └── components/  # Shared UI components
│   ├── passport-ocr-admin/  # Expo mobile app (LEO ADMIN)
│   │   ├── app/             # expo-router file-based routes
│   │   │   ├── (tabs)/      # Bottom tab screens
│   │   │   ├── admin/       # Admin-only screens
│   │   │   ├── passport/    # Passport detail
│   │   │   ├── billing/     # Billing detail
│   │   │   └── ...
│   │   └── lib/             # auth.tsx, api.ts, useColors.ts
│   └── mockup-sandbox/      # Internal design component previews
├── lib/
│   ├── api-spec/            # openapi.yaml — source of truth for all endpoints
│   ├── api-client-react/    # Orval-generated React Query hooks + custom fetch
│   ├── api-zod/             # Orval-generated Zod schemas
│   └── db/                  # Drizzle ORM schema, migrations, client
├── scripts/                 # Utility scripts
├── pnpm-workspace.yaml      # Workspace package catalog & version pins
├── tsconfig.base.json       # Shared strict TypeScript config
└── tsconfig.json            # Solution file (libs only)
```

---

## 3. Environment & Secrets

All secrets are managed through Replit Secrets (never committed to code).

| Variable | Where used | Purpose |
|---|---|---|
| `DATABASE_URL` | API server, DB lib | PostgreSQL connection string |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | API server OCR | Replit AI proxy base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API server OCR | Replit AI proxy key |
| `SUPERUSER_EMAIL` | API server bootstrap | Seeds the first superuser account |
| `SUPERUSER_PASSWORD` | API server bootstrap | Password for the superuser seed |
| `SESSION_SECRET` | API server | Signs express-session cookies |
| `APP_PASSWORD` | API server | Optional app-level password gate |
| `EXPO_PUBLIC_DOMAIN` | Mobile app `.env` | Points Expo Go to `leomaldives.com` |

**EAS build env (eas.json):**  
Both `preview` and `production` EAS profiles inject `EXPO_PUBLIC_DOMAIN=leomaldives.com` so every built APK/IPA always hits production.

---

## 4. Database Schema

All tables are defined with Drizzle ORM in `lib/db/src/schema/`. Changes are applied with:

```bash
pnpm --filter @workspace/db run push
```

### 4.1 `users`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `email` | text UNIQUE NOT NULL | Lowercased on insert |
| `name` | text | Display name |
| `role` | text | `superuser` / `admin` / `client` / `company` / `employee` / `agent` |
| `is_approved` | boolean | Must be true to log in |
| `is_blocked` | boolean | Blocks login even if approved |
| `password_hash` | text | bcrypt hash |
| `linked_entity_id` | text | Links user to a passport/company record |
| `company_id` | integer | FK → companies (for company-role users) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 4.2 `passports`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `full_name` | text | Extracted by OCR |
| `passport_number` | text | Extracted + MRZ-validated |
| `date_of_birth` | text | ISO date string |
| `date_of_issue` | text | |
| `date_of_expiry` | text | |
| `address` | text | |
| `nationality` | text | |
| `status` | text | `processing` / `active` / `applied` / `employed` / `attention` / `completed` |
| `employee_type` | text | `casual` / `recruitment` / `direct` |
| `company_id` | integer | FK → companies (SET NULL on delete) |
| `client_id` | integer | FK → clients (SET NULL on delete) |
| `agency_salary` | numeric(12,2) | Daily rate agreed with employee |
| `client_salary` | numeric(12,2) | Daily rate billed to client |
| `agent_rate` | numeric(12,2) | One-time recruitment fee |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 4.3 `companies`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text NOT NULL | |
| `address` | text | |
| `phone` | text | |
| `email` | text | |
| `registration_number` | text | |
| `bank_name` | text | Payment details |
| `bank_account` | text | |
| `bank_ifsc` | text | |
| `letterhead_image` | text | Base64 data URL |
| `signature_image` | text | Base64 data URL |

### 4.4 `clients`

Similar structure to companies — name, address, contact info, branding images. Clients are the end-employers who receive invoices.

### 4.5 `billing_documents`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `kind` | text | `invoice` or `quotation` |
| `number` | text | e.g. `INV-2026-001` |
| `company_id` | integer | FK → companies (issuer) |
| `client_id` | integer | FK → clients (recipient) |
| `customer_name` | text | Snapshotted at creation |
| `customer_address` | text | Snapshotted at creation |
| `issue_date` | text | |
| `due_date` | text | |
| `gst_rate` | numeric | Tax % |
| `status` | text | `draft` / `sent` / `paid` / `overdue` |
| `notes` | text | |
| `created_at` | timestamptz | |

### 4.6 `billing_items`

Line items for billing_documents. Columns: `id`, `document_id` (FK), `description`, `qty`, `rate`, `amount`.

### 4.7 `loa_entries` (Letter of Appointment)

Snapshots all relevant data at creation time so historical documents never change when master data is updated.

| Column | Notes |
|---|---|
| `passport_id` | FK → passports |
| `company_id` | FK → companies |
| `company_name`, `company_address`, `company_phone` | Snapshotted |
| `candidate_name`, `candidate_passport_number` | Snapshotted |
| `candidate_address`, `candidate_nationality` | Snapshotted |
| `job_title` | |
| `basic_salary` | Monthly figure |
| `start_date` | |
| `created_at` | |

### 4.8 `salary_records`

| Column | Notes |
|---|---|
| `passport_id` | FK → passports |
| `month`, `year` | Payroll period |
| `days_worked` | For casual workers |
| `basic_salary`, `allowances`, `deductions`, `net_salary` | |
| `invoice_id` | Links to billing document |

### 4.9 `expenses`

| Column | Notes |
|---|---|
| `category_id` | FK → expense_categories |
| `amount`, `description`, `date` | |
| `receipt_image` | Base64 data URL |

### 4.10 `expense_categories`

Simple: `id`, `name`, `color`.

### 4.11 `tasks`

Self-referencing hierarchy for subtasks.

| Column | Notes |
|---|---|
| `title`, `description` | |
| `status` | `todo` / `in_progress` / `done` |
| `priority` | `low` / `medium` / `high` |
| `parent_id` | FK → tasks (null = root task) |
| `due_date` | |

### 4.12 `role_permissions`

Granular per-role, per-module permission matrix.

| Column | Notes |
|---|---|
| `role` | One of the 6 roles |
| `module` | e.g. `passports`, `billing`, `salary` |
| `can_view`, `can_edit`, `can_delete` | booleans |

### 4.13 `app_settings`

Singleton row (always id=1).

| Column | Notes |
|---|---|
| `app_name` | Displayed in app header |
| `company_name`, `company_address`, `company_phone`, `company_email`, `company_website`, `company_registration_number` | Appear on printed documents |
| `logo_image` | Base64 data URL |
| `accent_hue` | 0–360 HSL hue for theme colour |
| `openai_api_key` | Overrides env var if set |

### 4.14 `push_tokens`

Stores Expo push notification tokens per user. Columns: `user_id`, `token`, `created_at`.

---

## 5. API Server

**Entry point:** `artifacts/api-server/src/index.ts`  
**Build:** esbuild bundles to `dist/index.mjs` (CJS-compatible ESM)  
**Port:** Reads `process.env.PORT`, defaults to 8080  
**Base path:** All routes are prefixed `/api`

### 5.1 Middleware Stack (in order)

1. `pino-http` — structured request logging
2. `cors` — open in dev, locked to domain in prod
3. `express.json()` — JSON body parsing
4. `express-session` — cookie-based sessions backed by PostgreSQL (`connect-pg-simple`)
5. `populateFromBearerToken` — mobile clients send `Authorization: Bearer <sessionId>`; this middleware rehydrates the session from the token
6. Route handlers

### 5.2 Route Files

| File | Prefix | Description |
|---|---|---|
| `auth.ts` | `/api/auth` | Register, login, logout, me, change-password, extension-token |
| `admin-users.ts` | `/api/admin/users` | User CRUD (admin + superuser only) |
| `admin-permissions.ts` | `/api/admin/permissions` | Role permission matrix read/write |
| `passports.ts` | `/api/passports` | Passport CRUD + file upload + OCR trigger |
| `companies.ts` | `/api/companies` | Company CRUD |
| `clients.ts` | `/api/clients` | Client CRUD |
| `billing.ts` | `/api/billing` | Invoice/quotation CRUD |
| `loa.ts` | `/api/loa` | LOA CRUD |
| `loa-options.ts` | `/api/loa-options` | Dropdown data for LOA form |
| `salary-records.ts` | `/api/salary-records` | Payroll records CRUD |
| `expenses.ts` | `/api/expenses` | Expense CRUD |
| `expense-categories.ts` | `/api/expense-categories` | Category CRUD |
| `tasks.ts` | `/api/tasks` | Task CRUD with subtask support |
| `system.ts` | `/api/system/settings` | App settings GET/PATCH (superuser) |
| `xpat.ts` | `/api/xpat` | Maldives Xpat portal proxy |
| `public-profile.ts` | `/api/public-profile` | Unauthenticated employee profile endpoint |
| `public-reads.ts` | `/api/public` | Print preview endpoints (LOA, billing) |
| `push-tokens.ts` | `/api/push-tokens` | Expo push token registration |
| `passwords.ts` | `/api/passwords` | Password CRUD for stored credentials |
| `health.ts` | `/api/healthz` | Health check, always returns 200 |

### 5.3 Key Middleware Functions

```typescript
// auth.ts
requireAuth(req, res, next)      // 401 if not logged in
requireRole(...roles)(req, res, next) // 403 if wrong role
```

Both functions check `req.session.authenticated`, `req.session.role`, etc. The session is populated either by cookie (web) or by `populateFromBearerToken` (mobile).

---

## 6. Authentication & RBAC

### 6.1 Registration Flow

```
POST /api/auth/register  { email, password, name }
→ Hashes password with bcrypt (10 rounds)
→ Inserts user with is_approved=false
→ Returns 201
→ Admin/superuser must approve in User Management before the user can log in
```

### 6.2 Login Flow

```
POST /api/auth/login  { email, password }
→ Looks up user by email
→ Checks is_approved (403 if not)
→ Checks is_blocked (403 if blocked)
→ bcrypt.compare(password, hash)
→ Calls session.regenerate() to prevent session fixation
→ Sets session.authenticated, userId, role, userEmail, userName, linkedEntityId
→ Returns { token: req.session.id }  ← used by mobile as Bearer token
```

### 6.3 Mobile Bearer Token Auth

React Native has no cookie jar. The login response includes `{ token: session_id }`. Mobile stores this in `expo-secure-store` and sends it as `Authorization: Bearer <token>` on every request. The `populateFromBearerToken` middleware in the API rehydrates the session from this token.

### 6.4 Role Hierarchy

```
superuser  →  Full access to everything including system settings, user management
  admin    →  All data + user management, cannot change system settings
    client →  Read-only access scoped to their linked company
    company →  Can view their own employees
    employee → Salary and own profile only
      agent → Passport upload and limited read
```

### 6.5 Dynamic Permission Matrix

Beyond the static role hierarchy, a `role_permissions` table stores fine-grained per-module flags. The `GET /api/admin/permissions` endpoint returns the full matrix; `PUT` overwrites it. The UI renders a table where superusers can toggle can_view/can_edit/can_delete per role per module.

### 6.6 First-Boot Superuser Seed

`bootstrap-users.ts` runs on every server start:

1. Ensures the `users` table and required columns exist (idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`)
2. Checks if any `superuser` row exists — if not, reads `SUPERUSER_EMAIL` + `SUPERUSER_PASSWORD` from env, hashes the password, and inserts the superuser row.

---

## 7. OCR Pipeline

**File:** `artifacts/api-server/src/lib/ocr.ts`

### 7.1 Upload Flow

```
POST /api/passports/upload  (multipart/form-data, field: "file")
→ multer stores file in memory (no disk write)
→ If PDF: pdf2pic converts each page to JPEG buffer
→ Each image: sharp resizes to max 1600×1200 (reduces tokens)
→ Creates a passport row with status="processing"
→ Returns the new record immediately (non-blocking)
→ OCR runs in background, updates record to status="completed" or "failed"
```

### 7.2 GPT-4o Vision Extraction

The image is base64-encoded and sent to `gpt-4o` (via Replit AI Integrations proxy) with a structured prompt requesting:

- Full name
- Passport number
- Date of birth, issue, expiry
- Address
- Nationality
- The raw MRZ lines (two lines at the bottom of the passport)

### 7.3 MRZ Validation & Merging

After GPT returns the fields, the `mrz` library parses and checksum-validates the MRZ lines. The merge strategy:

| Field | Source preference |
|---|---|
| Passport number | MRZ (if checksum passes) → GPT fallback |
| Date of birth | MRZ (if checksum passes) → GPT fallback |
| Date of expiry | MRZ (if checksum passes) → GPT fallback |
| Nationality | MRZ → GPT fallback |
| Full name | MRZ (formatted) → GPT fallback |
| Date of issue | GPT only (not in MRZ) |
| Address | GPT only (not in MRZ) |

If MRZ check digits fail, the `mrz` library attempts to recover the passport number by edit-distance matching against GPT's reading.

---

## 8. Web Application

**Tech:** React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter (routing)  
**Entry:** `artifacts/passport-ocr/src/main.tsx`

### 8.1 Routing (wouter)

All routes are defined in `src/App.tsx`:

| Path | Page | Auth required |
|---|---|---|
| `/login` | Login | No |
| `/signup` | Register | No |
| `/` | Dashboard | Yes |
| `/master-list` | All passports | Yes |
| `/upload` | Upload passport | Yes |
| `/employees/:id` | Employee profile | Yes |
| `/companies` | Companies list | Yes |
| `/clients` | Clients list | Yes |
| `/loa` | LOA management | Yes |
| `/billing` | Billing (invoices/quotations) | Yes |
| `/expenses` | Expense tracker | Yes |
| `/salary` | Salary records | Yes |
| `/tasks` | Task management | Yes |
| `/users` | User management | admin + superuser |
| `/permissions` | Permission matrix | superuser |
| `/settings` | System settings | superuser |
| `/profile` | Own profile | Yes |
| `/loa/:id/print` | Printable LOA | Public |
| `/billing/:id/print` | Printable invoice | Public |
| `/u/:userId` | Public employee profile | Public |

### 8.2 Auth Gate (`src/components/auth-gate.tsx`)

Wraps all protected routes. On mount it calls `GET /api/auth/me`. If the response is 401, it redirects to `/login`. The `me` response includes `{ userId, email, name, role }` — role is stored in React context and used to conditionally show/hide nav items.

### 8.3 App Layout (`src/components/layout/app-layout.tsx`)

Left sidebar with navigation links. Visibility rules:

- **User Management** — only shown to `admin` and `superuser`
- **Permissions** — only shown to `superuser`
- **System Settings** — only shown to `superuser`

### 8.4 Print Pages

`/loa/:id/print` and `/billing/:id/print` are public routes (no auth) that render a clean print-friendly version. They use the company's letterhead and signature images stored in the database. Called via `window.print()` triggered from the main app.

---

## 9. Mobile Application (LEO ADMIN)

**Tech:** Expo SDK 52, expo-router (file-based), React Native, TanStack Query  
**Package:** `com.leo.admin`  
**Entry:** `artifacts/passport-ocr-admin/app/_layout.tsx`

### 9.1 Navigation Structure

```
app/
├── _layout.tsx          # Root stack — sets up QueryClient, AuthProvider, base URL
├── login.tsx            # Login screen
├── signup.tsx           # Register screen
├── (tabs)/              # Bottom tab bar (role-aware)
│   ├── _layout.tsx      # Tab definitions, role-gated href:null
│   ├── index.tsx        # Dashboard
│   ├── master.tsx       # Master list
│   ├── upload.tsx       # Upload passport
│   ├── billing.tsx      # Billing list
│   ├── salary.tsx       # Salary records
│   └── more.tsx         # More menu (admin, settings, etc.)
├── passport/[id].tsx    # Passport detail & edit
├── billing/[id].tsx     # Billing detail & print
├── loa/index.tsx        # LOA management
├── companies/[id].tsx   # Company detail
├── clients/[id].tsx     # Client detail
├── expenses.tsx         # Expense tracker
├── admin/
│   ├── users.tsx        # User management
│   └── system-settings.tsx  # App + company settings
├── profile.tsx          # Own profile
└── passwords.tsx        # Stored passwords
```

### 9.2 Tab Visibility by Role

In `(tabs)/_layout.tsx` each tab has an `href` prop set to `null` for roles that should not see it:

| Tab | Hidden for |
|---|---|
| Master List | `employee` |
| Upload | `employee`, `client` |
| Billing | `employee`, `client` |
| Salary | `client`, `company` |
| More (admin items) | non-admin |

### 9.3 Auth Provider (`lib/auth.tsx`)

Wraps the app with a React context providing:

- `user` — `{ id, email, name, role }` or `null`
- `login(email, password)` — calls `POST /api/auth/login`, stores token in SecureStore
- `logout()` — calls `POST /api/auth/logout`, clears SecureStore
- `register(email, password, name)` — calls `POST /api/auth/register`

Token persistence: On app load, `getItemAsync("authToken")` from `expo-secure-store` rehydrates the session. On web (Expo Go browser mode) SecureStore is unavailable — the code wraps all SecureStore calls in try/catch and falls back to in-memory storage.

### 9.4 Dashboard (`(tabs)/index.tsx`)

The dashboard is the most complex screen. It contains:

- **Hero stats row** — total expenses, revenue, profit
- **Passport stats tabs** — All / Processing / Active / Attention counts
- **Candidates widget** — filterable list of recent passports with status pill + employee type pill
- **Monthly billing chart** — stacked bar chart (revenue vs expenses) using react-native-gifted-charts
- **Tasks widget** — quick task list with status icons
- **Recent activity** — latest passport/billing updates

### 9.5 API Base URL Resolution

```typescript
// app/_layout.tsx
if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}
```

In development (Expo Go): reads `.env` which sets `EXPO_PUBLIC_DOMAIN=leomaldives.com`.  
In EAS builds: `eas.json` injects `EXPO_PUBLIC_DOMAIN=leomaldives.com` at build time.

---

## 10. Shared Libraries

### 10.1 `@workspace/db`

**Path:** `lib/db/`  
**What it contains:**
- `src/schema/` — all Drizzle table definitions (one file per domain)
- `src/schema/index.ts` — barrel export
- `src/client.ts` — creates the Drizzle/pg pool (reads `DATABASE_URL`)
- `drizzle.config.ts` — points drizzle-kit at the schema and DB

**Usage in API server:**
```typescript
import { db } from "@workspace/db";
import { passportsTable } from "@workspace/db/schema";
const rows = await db.select().from(passportsTable);
```

### 10.2 `@workspace/api-client-react`

**Path:** `lib/api-client-react/`  
**Generated by:** Orval from `lib/api-spec/openapi.yaml`  
**Contains:**
- `src/generated/api.ts` — all React Query hooks (e.g. `useListPassports`, `useLogin`, `useCreateBillingDocument`)
- `src/generated/api.schemas.ts` — TypeScript types for all request/response bodies
- `src/custom-fetch.ts` — custom fetch function supporting bearer tokens, base URL injection, error normalisation
- `src/index.ts` — barrel export

**Usage:**
```typescript
import { useListPassports, useCreatePassport } from "@workspace/api-client-react";
const { data, isLoading } = useListPassports();
```

### 10.3 `@workspace/api-zod`

**Path:** `lib/api-zod/`  
**Generated by:** Orval (second target) from the same OpenAPI spec  
**Contains:** Zod schemas for every request/response type  
**Used by:** API server route handlers for input validation

```typescript
import { CreatePassportBody } from "@workspace/api-zod";
const parsed = CreatePassportBody.safeParse(req.body);
```

---

## 11. OpenAPI Contract & Codegen

**Source of truth:** `lib/api-spec/openapi.yaml`

All API endpoints, request bodies, response shapes, and error formats are defined here **first**. No route should exist that is not in the spec.

**Regenerate after any spec change:**
```bash
pnpm --filter @workspace/api-spec run codegen
```

This runs Orval twice (configured in `lib/api-spec/orval.config.ts`):
1. Target `api-client-react` → writes to `lib/api-client-react/src/generated/`
2. Target `api-zod` → writes to `lib/api-zod/src/generated/`

Then runs `pnpm run typecheck:libs` to verify the generated code compiles.

**Never manually edit generated files.** They are overwritten on every codegen run.

---

## 12. Billing System

**API:** `GET/POST /api/billing`, `GET/PATCH/DELETE /api/billing/:id`  
**Web:** `src/pages/billing.tsx`, `src/pages/billing-print.tsx`  
**Mobile:** `app/(tabs)/billing.tsx`, `app/billing/[id].tsx`

### 12.1 Document Types

Both invoices and quotations share the `billing_documents` table, distinguished by `kind: "invoice" | "quotation"`.

### 12.2 Line Items

Each document has N line items in `billing_items`: description, qty, rate, amount. Amount = qty × rate (calculated client-side, stored for history).

### 12.3 GST Calculation

`gst_rate` (e.g. 6 for 6%) is stored per document. The print view computes:
- Subtotal = sum of all item amounts
- GST amount = subtotal × gst_rate / 100
- Total = subtotal + GST

### 12.4 Snapshotting

When a billing document is created, `customer_name` and `customer_address` are copied from the linked client record. This means if you later edit the client's address, old invoices still show the original address.

### 12.5 Print View

`/billing/:id/print` (web) is a standalone page that renders a print-ready invoice/quotation using the company's letterhead image (stored in app_settings as base64), logo, and signature. Triggered via `window.open()` + `window.print()`.

### 12.6 Statuses

`draft` → `sent` → `paid` / `overdue`

---

## 13. LOA (Letter of Appointment)

**API:** `GET/POST /api/loa`, `GET/PATCH/DELETE /api/loa/:id`  
**Print:** `GET /api/public/loa/:id` (unauthenticated)  
**Web:** `src/pages/loa.tsx`, `src/pages/loa-print.tsx`  
**Mobile:** `app/loa/index.tsx`

### How it works

1. User selects a passport (candidate) and a company
2. Fills in job title, salary, start date
3. On save, the server **snapshots** all relevant data:
   - Company name, address, phone, letterhead image
   - Candidate name, passport number, nationality, address
4. The LOA print view uses only the snapshotted data — editing the company or candidate afterwards has no effect on existing LOAs
5. Print URL is public (no auth) so it can be shared with candidates directly

---

## 14. Salary & Payroll

**API:** `GET/POST /api/salary-records`, `PATCH/DELETE /api/salary-records/:id`  
**Web:** `src/pages/salary.tsx`  
**Mobile:** `app/(tabs)/salary.tsx`

### Salary Calculation Logic (in dashboard profitability chart)

**Casual employees** (daily rate):
```
profit = (client_salary − agency_salary) × days_worked
```

**Recruitment employees** (one-time fee):
```
profit = agent_rate − client_salary
```

Each `salary_record` stores: `passport_id`, `month`, `year`, `days_worked`, `basic_salary`, `allowances`, `deductions`, `net_salary`, and optionally links to a `billing_document` (invoice).

### Filter Behaviour

- Web salary page: shows only `casual` employee type by default (matches mobile parity)
- Mobile salary page: same filter

---

## 15. Expenses

**API:** `GET/POST /api/expenses`, `PATCH/DELETE /api/expenses/:id`  
**API:** `GET/POST /api/expense-categories`  
**Web:** `src/pages/expenses.tsx`, `src/pages/expense-voucher-print.tsx`  
**Mobile:** `app/expenses.tsx`

Expenses have a category (with colour), amount, date, description, and an optional receipt image (base64). The expense voucher print page renders a clean printable receipt using company letterhead.

---

## 16. Tasks

**API:** `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`

Tasks support a self-referencing hierarchy via `parent_id`. Root tasks (`parent_id = null`) appear as top-level items; tasks with a `parent_id` are subtasks. The dashboard widget shows the most recent tasks with status icons.

Fields: `title`, `description`, `status` (todo/in_progress/done), `priority` (low/medium/high), `due_date`, `parent_id`, timestamps.

---

## 17. Xpat Integration

**API:** `GET /api/xpat/work-permit`, `GET /api/xpat/photo`  
**Mobile:** Used in the passport detail screen (`app/(tabs)/index.tsx` CARD_DOMAIN constant)

The Xpat integration proxies requests to the Maldives immigration Xpat portal. It requires both `WorkPermitNumber` and `PassportNumber` in the query. The API key is hardcoded server-side in `artifacts/api-server/src/lib/xpat.ts`. Photos and work-permit cards are served via backend proxy routes (the mobile app uses `img src` pointing to the backend proxy URL, not the Xpat portal directly).

---

## 18. Companies & Clients

Both entities have the same structure and are managed independently.

**Companies** are the agency's business clients (who pay invoices and have employees assigned).  
**Clients** are referenced in billing documents as the invoice recipient.

Both support:
- Basic info (name, address, phone, email, registration number)
- Bank details (bank_name, bank_account, bank_ifsc)
- Branding images (letterhead_image, signature_image) — stored as base64 data URLs, used on printed documents

---

## 19. System Settings

**API:** `GET/PATCH /api/system/settings` (superuser only)  
**Mobile:** `app/admin/system-settings.tsx`  
**Web:** `src/pages/settings.tsx`

The `app_settings` table always has exactly one row (id=1, auto-seeded on first boot). Settings include:

- App name, accent colour hue
- Company details (name, address, phone, email, website, registration number)
- Logo image (base64)
- OpenAI API key (if set, overrides the env var for OCR)

Superusers can update all fields. Non-superusers cannot access this endpoint.

---

## 20. Deployment

### 20.1 Web + API (Replit Autoscale)

The project is deployed on Replit Autoscale at **`https://leomaldives.com`**.

Both the web frontend and API server are served from the same deployment via a path-based proxy:
- `/api/*` → API server (port 8080)
- `/*` → Vite web frontend

**Publish steps:**
1. Ensure all typechecks pass: `pnpm run typecheck`
2. Ensure no errors in workflow logs
3. Click **Publish** in Replit

On deployment, Replit detects schema changes between dev and production databases and prompts to apply them.

### 20.2 Mobile App (EAS)

**Preview APK (side-loadable Android):**
```bash
cd artifacts/passport-ocr-admin
eas login               # one-time, uses your Expo account
eas build -p android --profile preview
```
Returns a download URL for the `.apk`. Takes ~10–15 minutes on Expo's build servers.

**Production AAB (Google Play):**
```bash
eas build -p android --profile production
```

**iOS IPA:**
```bash
eas build -p ios --profile preview
```
Requires paid Apple Developer membership ($99/year).

Both EAS profiles inject `EXPO_PUBLIC_DOMAIN=leomaldives.com` so the built app always hits production.

---

## 21. Development Workflow

### 21.1 Starting all services

Services are managed as Replit Workflows (not `pnpm dev` at root):

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Web frontend
pnpm --filter @workspace/passport-ocr run dev

# Mobile (Expo Go)
pnpm --filter @workspace/passport-ocr-admin run dev
```

### 21.2 After changing the OpenAPI spec

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates all hooks and Zod schemas. Commit the generated files.

### 21.3 After changing DB schema

```bash
pnpm --filter @workspace/db run push
```

For production, Replit's deployment UI shows the diff and asks for confirmation before applying.

### 21.4 Typechecking

```bash
pnpm run typecheck           # full check (all packages)
pnpm --filter @workspace/api-server run typecheck   # single package
```

### 21.5 Common Gotchas

| Problem | Fix |
|---|---|
| Hooks have stale types after spec change | Run codegen |
| `@workspace/db` types missing after schema change | Run `pnpm run typecheck:libs` |
| PDF conversion fails | Run `pnpm approve-builds` and select `sharp` |
| Mobile app hits dev server instead of production | Check `.env` has `EXPO_PUBLIC_DOMAIN=leomaldives.com` |
| New user can't log in | They need to be approved by admin in User Management |
| Session not persisting in mobile | Ensure all auth-checking routes call `populateFromBearerToken()` |
| `expo-secure-store` crashes in web mode | All SecureStore calls must be wrapped in try/catch with in-memory fallback |

---

## 22. Key Architectural Decisions

### Contract-First API
The OpenAPI spec is written **before** any route implementation. This enforces consistency: the server validates inputs using Zod schemas generated from the spec, and clients use React Query hooks generated from the same spec. Type safety flows end-to-end from DB schema → Drizzle types → Zod validation → OpenAPI spec → generated hooks → React components.

### Async OCR
Passport uploads return immediately with a `processing` status record. OCR runs in the background and updates the record. This prevents HTTP timeouts on large PDFs and gives the UI a responsive feel. The client polls or uses query invalidation to detect when the record transitions to `completed`.

### Document Snapshotting
Both invoices and LOAs copy master data (company name, address, client details) into the document at creation time. This is intentional — historical documents must remain accurate even if the company changes its address or name. Never join live master data when rendering a printed invoice.

### Session-Based Auth for Web, Token-Based for Mobile
Web uses standard cookie sessions (HTTP-only, SameSite). Mobile uses the same session store but accesses it via a Bearer token (the session ID) because React Native has no cookie jar. The `populateFromBearerToken` middleware transparently bridges the two approaches — mobile and web share all the same route handlers.

### Unified Billing Table
Invoices and quotations are not in separate tables. They share `billing_documents` with a `kind` discriminator. This simplifies queries (list all documents, filter by kind) and avoids duplicating schema/logic for what are essentially the same document type.

### Dynamic Permission Matrix
Rather than hard-coding role checks in every route, a `role_permissions` table gives superusers the ability to tune access without code changes. The current implementation checks the matrix on the frontend for UI visibility; server-side enforcement uses the static `requireRole` middleware for critical operations.

---

*This document was auto-generated from the live codebase on June 23, 2026.*  
*For questions contact the system administrator at leomaldives.com.*
