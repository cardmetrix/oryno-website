import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { disableTotp, jsonTotpError } from "@/lib/security/totp-auth";
import { attachTwoFactorCookie } from "@/lib/security/totp-session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = String(body.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the 6-digit authenticator code to turn off 2FA." },
        { status: 400 },
      );
    }

    await disableTotp({ userId: user.id, code });
    const res = NextResponse.json({ ok: true, twoFactorEnabled: false });
    attachTwoFactorCookie(res, null);
    return res;
  } catch (error) {
    const mapped = jsonTotpError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
