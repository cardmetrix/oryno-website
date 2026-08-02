import { appBaseUrl, brandLogoUrl, supportInbox } from "@/lib/email/client";

export type BrandedEmailContent = {
  preheader?: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  footerNote?: string;
};

/** Table-based HTML shell for reliable email clients. */
export function renderBrandedEmail(content: BrandedEmailContent) {
  const base = appBaseUrl();
  const logo = brandLogoUrl();
  const support = supportInbox();
  const year = new Date().getFullYear();
  const ctaHref = content.cta
    ? content.cta.href.startsWith("http")
      ? content.cta.href
      : `${base}${content.cta.href.startsWith("/") ? "" : "/"}${content.cta.href}`
    : null;

  const preheader = content.preheader || content.title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1e;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2ef;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #ebe6e0;">
          <tr>
            <td style="background:linear-gradient(135deg,#FF6A00 0%,#ff8a33 100%);padding:22px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logo}" width="40" height="40" alt="ORYNO" style="display:block;border-radius:10px;border:0;" />
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">ORYNO</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.88);margin-top:2px;">Borderless wallet</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:800;color:#1c1c1e;">
                ${escapeHtml(content.title)}
              </h1>
              <div style="font-size:15px;line-height:1.6;color:#3a3a3c;">
                ${content.bodyHtml}
              </div>
              ${
                content.cta && ctaHref
                  ? `<div style="margin:24px 0 8px;">
                      <a href="${escapeAttr(ctaHref)}" style="display:inline-block;background:#FF6A00;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px;">
                        ${escapeHtml(content.cta.label)}
                      </a>
                    </div>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#8e8e93;">
                ${
                  content.footerNote
                    ? escapeHtml(content.footerNote)
                    : "If you didn’t expect this email, contact support right away."
                }
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#1c1c1e;padding:20px 28px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#ffffff;">ORYNO</p>
              <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.72);">
                Pay bills, buy airtime &amp; gift cards, and move money from one secure wallet.
              </p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.55);">
                <a href="${escapeAttr(base)}" style="color:#FF6A00;text-decoration:none;">${escapeHtml(base.replace(/^https?:\/\//, ""))}</a>
                ·
                <a href="mailto:${escapeAttr(support)}" style="color:#FF6A00;text-decoration:none;">${escapeHtml(support)}</a>
                · © ${year}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function plainTextFromParts(input: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  const base = appBaseUrl();
  const lines = [input.title, "", input.body];
  if (input.cta) {
    const href = input.cta.href.startsWith("http")
      ? input.cta.href
      : `${base}${input.cta.href.startsWith("/") ? "" : "/"}${input.cta.href}`;
    lines.push("", `${input.cta.label}: ${href}`);
  }
  lines.push("", `— ORYNO · ${supportInbox()}`);
  return lines.join("\n");
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function paragraphsToHtml(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`)
    .join("");
}
