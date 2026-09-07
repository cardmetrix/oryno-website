import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendBrandedEmail } from "@/lib/email/send";
import { walletFundedEmailContent } from "@/lib/email/wallet-funded-email";
import { withdrawalSuccessfulEmailContent } from "@/lib/email/withdrawal-successful-email";
import type { NotificationType } from "@/lib/notification-types";

const CTA_BY_TYPE: Partial<
  Record<NotificationType | string, { label: string; href: string }>
> = {
  fund: { label: "View wallet", href: "/wallet" },
  withdraw: { label: "View wallet", href: "/wallet" },
  transfer: { label: "View wallet", href: "/wallet" },
  kyc: { label: "Open KYC", href: "/settings/kyc" },
  security: { label: "Review security", href: "/settings/security" },
  service: { label: "Open services", href: "/services" },
  success: { label: "Open ORYNO", href: "/dashboard" },
  system: { label: "Open ORYNO", href: "/dashboard" },
  gift_card: { label: "View gift cards", href: "/services/gift-cards" },
  airtime: { label: "View history", href: "/history" },
  data: { label: "View history", href: "/history" },
  bill: { label: "View history", href: "/history" },
  social: { label: "Open boosts", href: "/services/social" },
  virtual_number: {
    label: "Open numbers",
    href: "/services/virtual-numbers",
  },
  email: { label: "Open emails", href: "/services/emails" },
  referral: { label: "View referrals", href: "/referrals" },
};

async function emailPreferenceEnabled(clerkId: string | null | undefined) {
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

export async function deliverNotificationEmail(input: {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType | string;
  href?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Force send even if preference is off (security / auth). */
  force?: boolean;
  toEmail?: string | null;
  userName?: string | null;
}) {
  const user =
    input.toEmail && input.userName
      ? {
          email: input.toEmail,
          fullName: input.userName,
          clerkId: null as string | null,
        }
      : await db.query.users.findFirst({
          where: eq(users.id, input.userId),
          columns: { email: true, fullName: true, clerkId: true },
        });

  if (!user?.email) return { ok: false as const, skipped: true as const };

  if (!input.force) {
    const allowed = await emailPreferenceEnabled(user.clerkId);
    if (!allowed) return { ok: false as const, skipped: true as const };
  }

  const href =
    input.href ||
    CTA_BY_TYPE[input.type || "system"]?.href ||
    "/notifications";
  const ctaLabel =
    CTA_BY_TYPE[input.type || "system"]?.label || "View in ORYNO";

  const meta = input.metadata ?? {};
  const amountFormatted =
    typeof meta.amountFormatted === "string" ? meta.amountFormatted : null;
  const reference =
    typeof meta.reference === "string"
      ? meta.reference
      : typeof meta.transactionId === "string"
        ? meta.transactionId
        : null;

  if (input.type === "fund" && amountFormatted && reference) {
    const content = walletFundedEmailContent({
      amountFormatted,
      reference,
    });

    return sendBrandedEmail({
      to: user.email,
      subject: content.subject,
      title: content.title,
      preheader: content.preheader,
      body: content.bodyPlain,
      bodyHtml: content.bodyHtml,
      cta: { label: ctaLabel, href },
      footerNote:
        "You’re receiving this because a wallet funding transaction completed on your ORYNO account. Manage preferences in Settings.",
    });
  }

  const withdrawStatus =
    typeof meta.status === "string" ? meta.status.toLowerCase() : "";
  const isWithdrawalSuccess =
    input.type === "withdraw" &&
    (withdrawStatus === "completed" ||
      /completed|successful/i.test(input.title));

  if (isWithdrawalSuccess && amountFormatted && reference) {
    const content = withdrawalSuccessfulEmailContent({
      amountFormatted,
      reference,
    });

    return sendBrandedEmail({
      to: user.email,
      subject: content.subject,
      title: content.title,
      preheader: content.preheader,
      body: content.bodyPlain,
      bodyHtml: content.bodyHtml,
      cta: { label: ctaLabel, href },
      footerNote:
        "You’re receiving this because a withdrawal completed on your ORYNO account. Manage preferences in Settings.",
    });
  }

  const firstName = user.fullName?.trim().split(/\s+/)[0] || "there";
  const greeting = `Hi ${firstName},`;

  return sendBrandedEmail({
    to: user.email,
    subject: input.title,
    title: greeting,
    preheader: input.body,
    body: input.body,
    bodyHtml: `<p style="margin:0 0 12px;">${escapeBasic(greeting)}</p><p style="margin:0 0 12px;">${escapeBasic(input.body)}</p>`,
    cta: { label: ctaLabel, href },
    footerNote:
      "You’re receiving this because activity happened on your ORYNO account. Manage preferences in Settings.",
  });
}

function escapeBasic(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDirectBrandedEmail(input: {
  to: string;
  title: string;
  body: string;
  subject?: string;
  href?: string;
  ctaLabel?: string;
}) {
  return sendBrandedEmail({
    to: input.to,
    subject: input.subject || input.title,
    title: input.title,
    body: input.body,
    cta: input.href
      ? {
          label: input.ctaLabel || "Open ORYNO",
          href: input.href,
        }
      : undefined,
  });
}
