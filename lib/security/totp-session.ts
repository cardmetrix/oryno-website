import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export const ORYNO_2FA_COOKIE = "oryno_2fa";
export const ORYNO_2FA_HEADER = "x-oryno-2fa";

const TOKEN_TTL_SEC = 60 * 60 * 24 * 14;

function signingKey() {
  const raw =
    process.env.TRANSACTION_PIN_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.DATABASE_URL ||
    "oryno-dev-2fa-session";
  return createHmac("sha256", "oryno-2fa").update(raw).digest();
}

type Payload = {
  u: string;
  s?: string;
  e: number;
};

export function issueTwoFactorToken(userId: string, sessionId?: string | null): string {
  const payload: Payload = {
    u: userId,
    e: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
  };
  if (sessionId) payload.s = sessionId;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

export function readTwoFactorTokenPayload(
  token: string | null | undefined,
): Payload | null {
  if (!token) return null;
  const [version, body, sig] = token.split(".");
  if (version !== "v1" || !body || !sig) return null;
  const expected = createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Payload;
    if (!payload?.u || typeof payload.e !== "number") return null;
    if (payload.e < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isTwoFactorTokenValid(input: {
  token: string | null | undefined;
  userId: string;
  sessionId?: string | null;
}): boolean {
  const payload = readTwoFactorTokenPayload(input.token);
  if (!payload) return false;
  if (payload.u !== input.userId) return false;
  if (payload.s && input.sessionId && payload.s !== input.sessionId) return false;
  return true;
}

export async function readTwoFactorToken(req?: Request): Promise<string | null> {
  const fromReq = req?.headers.get(ORYNO_2FA_HEADER)?.trim();
  if (fromReq) return fromReq;
  try {
    const h = await headers();
    const fromHeader = h.get(ORYNO_2FA_HEADER)?.trim();
    if (fromHeader) return fromHeader;
  } catch {
    // Route handlers without request headers() still work via cookies.
  }
  try {
    const jar = await cookies();
    return jar.get(ORYNO_2FA_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export function twoFactorCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TOKEN_TTL_SEC,
  };
}

export function attachTwoFactorCookie(
  res: NextResponse,
  token: string | null,
) {
  if (token) {
    res.cookies.set(ORYNO_2FA_COOKIE, token, twoFactorCookieOptions());
  } else {
    res.cookies.set(ORYNO_2FA_COOKIE, "", {
      ...twoFactorCookieOptions(),
      maxAge: 0,
    });
  }
  return res;
}
