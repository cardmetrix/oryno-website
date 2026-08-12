import { Resend } from "resend";

let resend: Resend | null = null;

export function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resend) resend = new Resend(key);
  return resend;
}

export function supportInbox() {
  return (
    process.env.RESEND_SUPPORT_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] ||
    "support@orynoafrica.com"
  );
}

export function mailFrom() {
  return process.env.RESEND_FROM_EMAIL?.trim() || "ORYNO <support@orynoafrica.com>";
}

export function appBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

export function brandLogoUrl() {
  return `${appBaseUrl()}/brand/oryno-logo.png`;
}

/** Circular brand logo for HTML emails. */
export function emailBrandLogoHtml(size = 36) {
  const logo = brandLogoUrl();

  return `<img src="${logo}" width="${size}" height="${size}" alt="ORYNO" style="display:block;width:${size}px;height:${size}px;border:0;border-radius:9999px;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
}
