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
import pushTokensRouter from "./push-tokens";
import systemRouter from "./system";
import xpatRouter from "./xpat";
import adminUsersRouter from "./admin-users";

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

// Admin-only: user management (superuser + admin)
router.use(requireRole("superuser", "admin"), adminUsersRouter);

// Everything below requires a valid session
router.use(requireAuth);
router.use(companiesRouter);
router.use(clientsRouter);
router.use(expenseCategoriesRouter);
router.use(expensesRouter);
router.use(loaRouter);
router.use(loaOptionsRouter);
router.use(billingRouter);
router.use(passwordsRouter);
router.use(tasksRouter);
router.use(pushTokensRouter);
router.use(xpatRouter);

export default router;
