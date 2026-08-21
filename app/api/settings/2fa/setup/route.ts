import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import {
  jsonTotpError,
  startTotpSetup,
} from "@/lib/security/totp-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = user.email || user.username || user.fullName || "ORYNO";
    const setup = await startTotpSetup({
      userId: user.id,
      accountLabel: account,
    });

    return NextResponse.json({
      ok: true,
      secret: setup.secret,
      uri: setup.uri,
    });
  } catch (error) {
    const mapped = jsonTotpError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
