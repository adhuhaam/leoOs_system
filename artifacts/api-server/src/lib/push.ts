import { eq, inArray, or, and } from "drizzle-orm";
import { db, passportsTable, pushTokensTable, usersTable } from "@workspace/db";
import { logger } from "./logger";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Internal: send a push notification to an explicit list of Expo push tokens.
 * Prunes tokens that Expo reports as no longer valid.
 */
async function sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  if (tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
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
        if (tokens[idx]) dead.push(tokens[idx]);
      }
    });
    if (dead.length > 0) {
      await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, dead));
      logger.info({ pruned: dead.length }, "removed dead push tokens");
    }
  } catch (err) {
    logger.warn({ err }, "expo push delivery threw");
  }
}

/**
 * Send the same notification to every registered device. Fire-and-forget so
 * push delivery never blocks an HTTP response.
 */
export async function broadcastPush(payload: PushPayload): Promise<void> {
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable);
  void sendToTokens(
    rows.map((r) => r.token),
    payload,
  );
}

const STATUS_LABELS: Record<string, string> = {
  processing: "Processing",
  completed: "Ready",
  active: "Active",
  attention: "Needs Attention",
  expired: "Expired",
};

/**
 * Send a targeted push to the agent, company user, and client user linked to
 * a passport when its status changes. Fire-and-forget — never awaited by callers.
 */
export async function sendPushToPassportStakeholders(
  passportId: number,
  newStatus: string,
  candidateName: string | null | undefined,
): Promise<void> {
  try {
    // 1. Fetch passport linkage fields
    const [passport] = await db
      .select({
        companyId: passportsTable.companyId,
        clientId: passportsTable.clientId,
        agent: passportsTable.agent,
      })
      .from(passportsTable)
      .where(eq(passportsTable.id, passportId))
      .limit(1);
    if (!passport) return;

    // 2. Build OR conditions: one clause per stakeholder type present
    type DrizzleCondition = ReturnType<typeof and>;
    const conditions: DrizzleCondition[] = [];

    if (passport.companyId != null) {
      conditions.push(
        and(
          eq(usersTable.role, "company"),
          eq(usersTable.linkedEntityId, String(passport.companyId)),
        ),
      );
    }
    if (passport.clientId != null) {
      conditions.push(
        and(
          eq(usersTable.role, "client"),
          eq(usersTable.linkedEntityId, String(passport.clientId)),
        ),
      );
    }
    if (passport.agent) {
      conditions.push(
        and(
          eq(usersTable.role, "agent"),
          eq(usersTable.linkedEntityId, passport.agent),
        ),
      );
    }
    if (conditions.length === 0) return;

    // 3. Find matching user ids
    const stakeholders = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(or(...conditions));
    if (stakeholders.length === 0) return;

    const stakeholderIds = stakeholders.map((s) => s.id);

    // 4. Get their push tokens
    const tokenRows = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(inArray(pushTokensTable.userId, stakeholderIds));
    if (tokenRows.length === 0) return;

    // 5. Build and send notification
    const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;
    const name = candidateName?.trim() || "Candidate";
    const title = `Passport status: ${statusLabel}`;
    const body = `${name}'s passport is now ${statusLabel.toLowerCase()}.`;

    await sendToTokens(tokenRows.map((r) => r.token), {
      title,
      body,
      data: { passportId, status: newStatus, screen: "passport" },
    });

    logger.info(
      { passportId, newStatus, recipients: stakeholderIds.length, tokens: tokenRows.length },
      "targeted push sent to passport stakeholders",
    );
  } catch (err) {
    logger.warn({ err, passportId }, "sendPushToPassportStakeholders threw");
  }
}
