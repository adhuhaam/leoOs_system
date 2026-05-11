import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { requireAuth } from "./auth";
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

const router: IRouter = Router();

// Public routes (no auth required)
router.use(healthRouter);
router.use(authRouter);
// /system/settings GET is public so the login screen can show the right brand
// name & logo. The PATCH inside this router self-checks for auth.
router.use(systemRouter);

// Everything below requires a valid session
router.use(requireAuth);
router.use(passportsRouter);
router.use(companiesRouter);
router.use(clientsRouter);
router.use(expenseCategoriesRouter);
router.use(expensesRouter);
router.use(loaRouter);
router.use(loaOptionsRouter);
router.use(billingRouter);
router.use(passwordsRouter);
router.use(tasksRouter);

export default router;
