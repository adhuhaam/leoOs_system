import { db, pushTokensTable } from "@workspace/db";
import { logger } from "./logger";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send the same notification to every registered device. Fire-and-forget so
 * push delivery never blocks an HTTP response. Tokens that come back as
 * "DeviceNotRegistered" are pruned so they stop showing up in the next batch.
 */
export async function broadcastPush(payload: PushPayload): Promise<void> {
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable);
  if (rows.length === 0) return;

  // Expo's push API accepts a single object or an array; we always send an
  // array so the response is uniformly shaped.
  const messages = rows.map((r) => ({
    to: r.token,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  try {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status, statusText: res.statusText },
        "expo push request failed",
      );
      return;
    }
    const json = (await res.json()) as {
      data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
    };
    // Prune tokens that Expo reports as no longer valid.
    const dead: string[] = [];
    json.data?.forEach((ticket, idx) => {
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        dead.push(rows[idx].token);
      }
    });
    if (dead.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, dead));
      logger.info({ pruned: dead.length }, "removed dead push tokens");
    }
  } catch (err) {
    logger.warn({ err }, "expo push delivery threw");
  }
}
