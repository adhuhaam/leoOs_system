import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";
import { RegisterPushTokenBody, UnregisterPushTokenParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/push-tokens", async (req, res): Promise<void> => {
  const parsed = RegisterPushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const token = parsed.data.token.trim();
  if (!token) {
    res.status(400).json({ error: "Token required" });
    return;
  }
  // Capture the authenticated user so targeted notifications reach the right device.
  const userId = req.session?.userId ?? null;

  // Upsert: keep one row per token, refresh userId + updated_at on every register.
  await db
    .insert(pushTokensTable)
    .values({ token, platform: parsed.data.platform, userId })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { platform: parsed.data.platform, userId, updatedAt: sql`now()` },
    });
  req.log.info({ platform: parsed.data.platform, userId }, "push token registered");
  res.sendStatus(204);
});

router.delete("/push-tokens/:token", async (req, res): Promise<void> => {
  const parsed = UnregisterPushTokenParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(pushTokensTable).where(eq(pushTokensTable.token, parsed.data.token));
  res.sendStatus(204);
});

export default router;
