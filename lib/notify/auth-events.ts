import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendDirectBrandedEmail } from "@/lib/email/notify-email";
import { createNotification } from "@/lib/notifications-service";

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

  await createNotification({
    userId: user.id,
    title: "New sign-in to ORYNO",
    body: `Hi ${user.fullName.split(" ")[0] || "there"}, you signed in on ${whenLabel()}. If this wasn’t you, secure your account immediately.`,
    type: "security",
    metadata: { href: "/settings/security", kind: "login" },
    forceEmail: true,
  });
}

export async function notifyUserLogout(user: {
  id: string;
  fullName: string;
}) {
  await createNotification({
    userId: user.id,
    title: "Signed out of ORYNO",
    body: `Your session ended on ${whenLabel()}. Sign in again anytime to access your wallet.`,
    type: "security",
    metadata: { href: "/login", kind: "logout" },
    forceEmail: true,
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
    await createNotification({
      userId: linked.id,
      title: "Admin console sign-in",
      body,
      type: "security",
      metadata: { href: "/admin", kind: "admin_login", adminId: admin.id },
      forceEmail: true,
    });
    return;
  }

  await sendDirectBrandedEmail({
    to: admin.email,
    title: "Admin console sign-in",
    subject: "ORYNO admin sign-in",
    body: `Hi ${admin.name},\n\n${body}`,
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
    await createNotification({
      userId: linked.id,
      title: "Admin console signed out",
      body,
      type: "security",
      metadata: { href: "/admin/login", kind: "admin_logout", adminId: admin.id },
      forceEmail: true,
    });
    return;
  }

  await sendDirectBrandedEmail({
    to: admin.email,
    title: "Admin console signed out",
    subject: "ORYNO admin signed out",
    body: `Hi ${admin.name},\n\n${body}`,
    href: "/admin/login",
    ctaLabel: "Admin login",
  }).catch((error) => console.error("[admin-logout-email]", error));
}
