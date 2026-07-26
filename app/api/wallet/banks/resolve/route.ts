import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { resolveBankAccount } from "@/lib/paystack/banks";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureWalletSchema();

    const body = (await req.json()) as {
      bankCode?: string;
      accountNumber?: string;
    };

    const resolved = await resolveBankAccount({
      bankCode: body.bankCode ?? "",
      accountNumber: body.accountNumber ?? "",
    });

    return NextResponse.json({
      ok: true,
      accountNumber: resolved.accountNumber,
      accountName: resolved.accountName,
      bankCode: resolved.bankCode,
      bankName: resolved.bankName,
      demoMode: resolved.demoMode,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not resolve account";
    console.error("[wallet-banks-resolve]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
