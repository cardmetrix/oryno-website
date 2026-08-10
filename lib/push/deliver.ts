import { clerkClient } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import type { NotificationType } from "@/lib/notification-types";
import {
  listPushTokensForUser,
  removeInvalidPushTokens,
} from "@/lib/push/tokens";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const CTA_BY_TYPE: Partial<
  Record<NotificationType | string, { href: string }>
> = {
  fund: { href: "/wallet" },
  withdraw: { href: "/wallet" },
  transfer: { href: "/wallet" },
  kyc: { href: "/settings/kyc" },
  security: { href: "/settings/security" },
  service: { href: "/services" },
  success: { href: "/dashboard" },
  system: { href: "/notifications" },
  gift_card: { href: "/services/gift-cards" },
  airtime: { href: "/history" },
  data: { href: "/history" },
  bill: { href: "/history" },
  social: { href: "/services/social" },
  virtual_number: { href: "/services/virtual-numbers" },
  email: { href: "/services/emails" },
  promo: { href: "/notifications" },
  referral: { href: "/referrals" },
};

async function pushPreferenceEnabled(clerkId: string | null | undefined) {
  if (!clerkId) return true;
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);
    const pref = clerkUser.publicMetadata?.notificationsEnabled;
    if (typeof pref === "boolean") return pref;
  } catch {
    // default on
  }
  return true;
}

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function sendExpoMessages(
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    sound: "default";
    badge?: number;
    channelId: string;
    priority: "high";
  }>,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const invalid: string[] = [];

  for (const batch of chunk(messages, 100)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[push] Expo API error", res.status, text);
      continue;
    }

    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    const tickets = json.data ?? [];
    tickets.forEach((ticket, index) => {
      if (ticket.status !== "error") return;
      const err = ticket.details?.error;
      if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
        invalid.push(batch[index].to);
      } else {
        console.warn("[push] ticket error", ticket.message, err);
      }
    });
  }

  if (invalid.length) {
    await removeInvalidPushTokens(invalid);
  }
}

export async function deliverNotificationPush(input: {
  userId: string;
  notificationId?: string;
  title: string;
  body: string;
  type?: NotificationType | string;
  href?: string | null;
  /** Force send even if preference is off (security / auth). */
  force?: boolean;
}) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { id: true, clerkId: true },
  });
  if (!user) return { ok: false as const, skipped: true as const };

  if (!input.force) {
    const allowed = await pushPreferenceEnabled(user.clerkId);
    if (!allowed) return { ok: false as const, skipped: true as const };
  }

  const tokens = await listPushTokensForUser(input.userId);
  if (!tokens.length) return { ok: false as const, skipped: true as const };

  const href =
    input.href ||
    CTA_BY_TYPE[input.type || "system"]?.href ||
    "/notifications";

  let badge = 1;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.unread, true),
        ),
      );
    badge = Math.max(1, row?.count ?? 1);
  } catch {
    // keep default
  }

  const messages = tokens.map((row) => ({
    to: row.token,
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 240),
    data: {
      notificationId: input.notificationId ?? null,
      type: input.type ?? "system",
      href,
    },
    sound: "default" as const,
    badge,
    channelId: "oryno-alerts",
    priority: "high" as const,
  }));

  await sendExpoMessages(messages);
  return { ok: true as const, skipped: false as const, count: messages.length };
}
