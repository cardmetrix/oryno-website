import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { currencyForCountry } from "@/lib/wallet";
import { convertWalletCurrency } from "@/lib/wallet-usd";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      direction?: "to_usd" | "to_local";
      amount?: string | number;
    };

    if (!body.direction || !["to_usd", "to_local"].includes(body.direction)) {
      return NextResponse.json(
        { error: "direction must be to_usd or to_local" },
        { status: 400 },
      );
    }

    const result = await convertWalletCurrency({
      userId: user.id,
      localCurrency: currencyForCountry(user.countryCode),
      direction: body.direction,
      amount: body.amount ?? 0,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      fromFormatted: formatMoney(result.fromAmount, result.fromCurrency),
      toFormatted: formatMoney(result.toAmount, result.toCurrency),
      // Receipt for the credit leg (destination wallet)
      transactionId: result.creditTransactionId,
    });
  } catch (error) {
    console.error("[wallet-convert]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Conversion failed",
      },
      { status: 400 },
    );
  }
}
