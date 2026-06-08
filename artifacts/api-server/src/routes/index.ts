import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { requireAuth, requireRole } from "./auth";
import passportsRouter from "./passports";
import companiesRouter from "./companies";
import clientsRouter from "./clients";
import expenseCategoriesRouter from "./expense-categories";
import expensesRouter from "./expenses";
import loaRouter from "./loa";
import loaOptionsRouter from "./loa-options";
import billingRouter from "./billing";
import passwordsRouter from "./passwords";
import tasksRouter from "./tasks";
import systemRouter from "./system";
import xpatRouter from "./xpat";
import adminUsersRouter from "./admin-users";
import adminPermissionsRouter from "./admin-permissions";
import publicReadsRouter from "./public-reads";
import { permissionsMiddleware } from "../lib/permissions";

const router: IRouter = Router();

// Public routes (no auth required)
router.use(healthRouter);
router.use(authRouter);
// /system/settings GET is public so the login screen can show the right brand
// name & logo. The PATCH inside this router self-checks for auth + role.
router.use(systemRouter);

// Passport routes handle their own per-route auth (reads: session or token,
// writes: session only) — see routes/passports.ts for details.
router.use(passportsRouter);

// Public read-only endpoints (LOA detail + companies) used by the LOA print
// page. Authenticated requests are deferred to the private routers below so
// role-scoped filtering still applies.
router.use(publicReadsRouter);

// Everything below requires a valid session
router.use(requireAuth);

// Admin-only guard scoped to /admin/* — does NOT affect any other routes
router.use("/admin", requireRole("superuser", "admin"));
// Tighter guard for permissions endpoint (superuser only)
router.use("/admin/permissions", requireRole("superuser"));

// Mount admin routers (their paths already include /admin/…)
router.use(adminUsersRouter);
router.use(adminPermissionsRouter);
// Module-level permission check (skips superuser/admin — handled by existing RBAC)
router.use(permissionsMiddleware);
router.use(companiesRouter);
router.use(clientsRouter);
router.use(expenseCategoriesRouter);
router.use(expensesRouter);
router.use(loaRouter);
router.use(loaOptionsRouter);
router.use(billingRouter);
router.use(passwordsRouter);
router.use(tasksRouter);
router.use(xpatRouter);

export default router;
