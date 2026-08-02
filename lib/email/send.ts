import { getResend, mailFrom } from "@/lib/email/client";
import {
  paragraphsToHtml,
  plainTextFromParts,
  renderBrandedEmail,
} from "@/lib/email/template";

export type SendBrandedEmailInput = {
  to: string | string[];
  subject: string;
  title: string;
  body: string;
  bodyHtml?: string;
  preheader?: string;
  cta?: { label: string; href: string };
  footerNote?: string;
  replyTo?: string;
};

export async function sendBrandedEmail(input: SendBrandedEmailInput) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY missing — skipped send:", input.subject);
    return { ok: false as const, skipped: true as const };
  }

  const to = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => e.trim())
    .filter(Boolean);

  if (to.length === 0) {
    return { ok: false as const, skipped: true as const };
  }

  const html = renderBrandedEmail({
    title: input.title,
    preheader: input.preheader || input.subject,
    bodyHtml: input.bodyHtml || paragraphsToHtml(input.body),
    cta: input.cta,
    footerNote: input.footerNote,
  });

  const text = plainTextFromParts({
    title: input.title,
    body: input.body,
    cta: input.cta,
  });

  const { error, data } = await resend.emails.send({
    from: mailFrom(),
    to,
    replyTo: input.replyTo,
    subject: input.subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email");
  }

  return { ok: true as const, id: data?.id ?? null };
}
