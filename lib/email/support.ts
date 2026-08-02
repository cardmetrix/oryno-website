import { getResend, mailFrom, supportInbox } from "@/lib/email/client";
import {
  escapeHtml,
  paragraphsToHtml,
  renderBrandedEmail,
} from "@/lib/email/template";

export { supportInbox, mailFrom as supportFrom } from "@/lib/email/client";

export async function sendSupportErrorReport(input: {
  errorMessage: string;
  page?: string | null;
  userNote?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
  url?: string | null;
  userAgent?: string | null;
}) {
  const resend = getResend();
  if (!resend) {
    throw new Error("Email is not configured");
  }

  const to = supportInbox();
  const subject = `[ORYNO Error] ${input.page || "App"} — ${input.errorMessage.slice(0, 80)}`;

  const lines = [
    "A user reported an error from the ORYNO app.",
    "",
    `Error: ${input.errorMessage}`,
    input.page ? `Page: ${input.page}` : null,
    input.url ? `URL: ${input.url}` : null,
    input.userName ? `Name: ${input.userName}` : null,
    input.userEmail ? `Email: ${input.userEmail}` : null,
    input.userId ? `User ID: ${input.userId}` : null,
    input.userAgent ? `Device: ${input.userAgent}` : null,
    input.userNote?.trim()
      ? `\nUser note:\n${input.userNote.trim()}`
      : null,
    `\nSent at: ${new Date().toISOString()}`,
  ].filter(Boolean) as string[];

  const detailRows = [
    ["Error", input.errorMessage],
    ["Page", input.page],
    ["URL", input.url],
    ["Name", input.userName],
    ["Email", input.userEmail],
    ["User ID", input.userId],
    ["Device", input.userAgent],
  ]
    .filter(([, v]) => Boolean(v))
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;color:#8e8e93;width:100px;vertical-align:top;">${escapeHtml(String(label))}</td><td style="padding:6px 0;color:#1c1c1e;">${escapeHtml(String(value))}</td></tr>`,
    )
    .join("");

  const html = renderBrandedEmail({
    title: "App error report",
    preheader: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;">A user reported an error from the ORYNO app.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;">${detailRows}</table>
      ${
        input.userNote?.trim()
          ? `<p style="margin:16px 0 0;"><strong>User note</strong></p>${paragraphsToHtml(input.userNote.trim())}`
          : ""
      }
    `,
    footerNote: "Internal support notification from the ORYNO app.",
  });

  const { error } = await resend.emails.send({
    from: mailFrom(),
    to: [to],
    replyTo: input.userEmail || undefined,
    subject,
    text: lines.join("\n"),
    html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send support email");
  }

  return { to };
}
