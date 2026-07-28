import { Resend } from "resend";

export function supportInbox() {
  return (
    process.env.RESEND_SUPPORT_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ||
    "support@oryno.com"
  );
}

export function supportFrom() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "ORYNO <support@oryno.com>"
  );
}

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
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("Email is not configured");
  }

  const resend = new Resend(key);
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
  ].filter(Boolean);

  const { error } = await resend.emails.send({
    from: supportFrom(),
    to: [to],
    replyTo: input.userEmail || undefined,
    subject,
    text: lines.join("\n"),
  });

  if (error) {
    throw new Error(error.message || "Failed to send support email");
  }

  return { to };
}
