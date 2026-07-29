import { createHmac, timingSafeEqual } from "crypto";
import { sogoWebhookSecret } from "@/lib/sogo/client";

export function verifySogoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
) {
  const secret = sogoWebhookSecret();
  if (!secret) {
    // Allow unsigned in demo / when secret not configured (dev only)
    if (process.env.NODE_ENV !== "production") return true;
    return false;
  }
  if (!signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
