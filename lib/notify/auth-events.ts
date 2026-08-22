import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { sendDirectBrandedEmail } from "@/lib/email/notify-email";
import {
  createNotification,
  type CreateNotificationInput,
} from "@/lib/notifications-service";
import { listPushTokensForUser } from "@/lib/push/tokens";

async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${normalized}`,
    columns: { id: true, fullName: true },
  });
}

function whenLabel() {
  return new Date().toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function recentAuthNotification(userId: string, kind: string) {
  const cutoff = new Date(Date.now() - 2 * 60_000);
  const row = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.userId, userId),
      eq(notifications.type, "security"),
      sql`${notifications.metadata}->>'kind' = ${kind}`,
      gt(notifications.createdAt, cutoff),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

/** In-app alert + one outbound channel (push preferred, else email). */
async function createAuthNotification(
  input: Omit<CreateNotificationInput, "email" | "push" | "forceEmail" | "forcePush">,
) {
  const kind =
    typeof input.metadata?.kind === "string" ? input.metadata.kind : null;
  if (kind && (await recentAuthNotification(input.userId, kind))) {
    return;
  }

  const tokens = await listPushTokensForUser(input.userId);
  const hasPush = tokens.length > 0;

  await createNotification({
    ...input,
    email: !hasPush,
    push: hasPush,
    forceEmail: !hasPush,
    forcePush: hasPush,
  });
}

export async function notifyUserLogin(user: {
  id: string;
  fullName: string;
  email: string;
  createdAt?: Date | null;
}) {
  // Skip if this is a brand-new signup (welcome emails already cover it)
  if (
    user.createdAt &&
    Date.now() - new Date(user.createdAt).getTime() < 90_000
  ) {
    return;
  }

  await createAuthNotification({
    userId: user.id,
    title: "New sign-in to ORYNO",
    body: `You signed in on ${whenLabel()}. If this wasn’t you, secure your account immediately.`,
    type: "security",
    metadata: { href: "/settings/security", kind: "login" },
  });
}

export async function notifyUserLogout(user: {
  id: string;
  fullName: string;
}) {
  await createAuthNotification({
    userId: user.id,
    title: "Signed out of ORYNO",
    body: `Your session ended on ${whenLabel()}. Sign in again anytime to access your wallet.`,
    type: "security",
    metadata: { href: "/login", kind: "logout" },
  });
}

export async function notifyAdminLogin(admin: {
  id: string;
  name: string;
  email: string;
}) {
  const linked = await findUserByEmail(admin.email);
  const body = `Admin console unlocked for ${admin.email} on ${whenLabel()}. Role session is active until you log out or it expires.`;

  if (linked) {
    await createAuthNotification({
      userId: linked.id,
      title: "Admin console sign-in",
      body,
      type: "security",
      metadata: { href: "/admin", kind: "admin_login", adminId: admin.id },
    });
    return;
  }

  await sendDirectBrandedEmail({
    to: admin.email,
    title: "Admin console sign-in",
    subject: "ORYNO admin sign-in",
    body,
    href: "/admin",
    ctaLabel: "Open admin",
  }).catch((error) => console.error("[admin-login-email]", error));
}

export async function notifyAdminLogout(admin: {
  id: string;
  name: string;
  email: string;
}) {
  const linked = await findUserByEmail(admin.email);
  const body = `Admin session for ${admin.email} ended on ${whenLabel()}.`;

  if (linked) {
    await createAuthNotification({
      userId: linked.id,
      title: "Admin console signed out",
      body,
      type: "security",
      metadata: { href: "/admin/login", kind: "admin_logout", adminId: admin.id },
    });
    return;
  }

  await sendDirectBrandedEmail({
    to: admin.email,
    title: "Admin console signed out",
    subject: "ORYNO admin signed out",
    body,
    href: "/admin/login",
    ctaLabel: "Admin login",
  }).catch((error) => console.error("[admin-logout-email]", error));
}
