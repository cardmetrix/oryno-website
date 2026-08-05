import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPushTokens } from "@/lib/db/schema";

const EXPO_TOKEN_RE = /^ExponentPushToken\[[\w-]+\]$/;

export function isExpoPushToken(token: string) {
  return EXPO_TOKEN_RE.test(token.trim());
}

export async function upsertPushToken(input: {
  userId: string;
  token: string;
  platform?: string;
  deviceId?: string | null;
  appVersion?: string | null;
}) {
  const token = input.token.trim();
  if (!isExpoPushToken(token)) {
    throw new Error("Invalid Expo push token");
  }

  const platform = (input.platform || "unknown").slice(0, 20);
  const deviceId = input.deviceId?.trim().slice(0, 120) || null;
  const appVersion = input.appVersion?.trim().slice(0, 40) || null;
  const now = new Date();

  const [row] = await db
    .insert(userPushTokens)
    .values({
      userId: input.userId,
      token,
      platform,
      deviceId,
      appVersion,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPushTokens.token,
      set: {
        userId: input.userId,
        platform,
        deviceId,
        appVersion,
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return row;
}

export async function listPushTokensForUser(userId: string) {
  return db.query.userPushTokens.findMany({
    where: eq(userPushTokens.userId, userId),
  });
}

export async function removePushToken(input: {
  userId: string;
  token?: string;
  deviceId?: string;
}) {
  if (input.token) {
    await db
      .delete(userPushTokens)
      .where(
        and(
          eq(userPushTokens.userId, input.userId),
          eq(userPushTokens.token, input.token.trim()),
        ),
      );
    return;
  }

  if (input.deviceId) {
    await db
      .delete(userPushTokens)
      .where(
        and(
          eq(userPushTokens.userId, input.userId),
          eq(userPushTokens.deviceId, input.deviceId.trim()),
        ),
      );
    return;
  }

  await db
    .delete(userPushTokens)
    .where(eq(userPushTokens.userId, input.userId));
}

export async function removeInvalidPushTokens(tokens: string[]) {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (!unique.length) return;
  await Promise.all(
    unique.map((token) =>
      db.delete(userPushTokens).where(eq(userPushTokens.token, token)),
    ),
  );
}
