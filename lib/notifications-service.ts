import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { deliverNotificationEmail } from "@/lib/email/notify-email";
import type {
  AppNotificationDto,
  NotificationType,
} from "@/lib/notification-types";
import { deliverNotificationPush } from "@/lib/push/deliver";

export type CreateNotificationInput = {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType | string;
  metadata?: Record<string, unknown>;
  unread?: boolean;
  /** Send branded email (default true). */
  email?: boolean;
  /** Ignore email preference toggle (login/security). */
  forceEmail?: boolean;
  /** Send mobile push (default true — mirrors email). */
  push?: boolean;
  /** Ignore push preference toggle (login/security). */
  forcePush?: boolean;
};

function formatRelativeTime(date: Date) {
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
  });
}

export function toNotificationDto(
  row: typeof notifications.$inferSelect,
): AppNotificationDto {
  const href =
    typeof row.metadata?.href === "string" ? row.metadata.href : null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    unread: row.unread,
    time: formatRelativeTime(row.createdAt),
    createdAt: row.createdAt.toISOString(),
    href,
    metadata: row.metadata ?? null,
  };
}

export async function createNotification(input: CreateNotificationInput) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type ?? "system",
      unread: input.unread ?? true,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (row) {
    const href =
      typeof input.metadata?.href === "string" ? input.metadata.href : null;

    if (input.email !== false) {
      void deliverNotificationEmail({
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type,
        href,
        force: input.forceEmail === true,
      }).catch((error) => {
        console.error("[notify-email]", error);
      });
    }

    if (input.push !== false) {
      void deliverNotificationPush({
        userId: input.userId,
        notificationId: row.id,
        title: input.title,
        body: input.body,
        type: input.type,
        href,
        force: input.forcePush === true || input.forceEmail === true,
      }).catch((error) => {
        console.error("[notify-push]", error);
      });
    }
  }

  return row;
}

/** Alias used for clarity at call sites that intentionally notify + email. */
export const notifyUser = createNotification;

export async function listUserNotifications(userId: string, limit = 50) {
  return db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });
}

export async function countUnread(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.unread, true)),
    );
  return row?.count ?? 0;
}

export async function markNotificationRead(userId: string, id: string) {
  const [row] = await db
    .update(notifications)
    .set({ unread: false, updatedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return row ?? null;
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ unread: false, updatedAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.unread, true)),
    );
}

export async function deleteNotification(userId: string, id: string) {
  const [row] = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteAllRead(userId: string) {
  await db
    .delete(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.unread, false)),
    );
}
