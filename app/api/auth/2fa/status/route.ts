import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { jsonTotpError, twoFactorStatus } from "@/lib/security/totp-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await twoFactorStatus({ userId: user.id, request: req });
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    const mapped = jsonTotpError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
