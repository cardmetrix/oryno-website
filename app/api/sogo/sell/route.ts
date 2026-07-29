import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { sellGiftCard, sogoErrorToEnglish } from "@/lib/sogo";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

type SellBody = {
  slug?: string;
  brandName?: string;
  cardCountry?: string;
  cardType?: "ecode" | "physical";
  subType?: "cash_receipt" | "debit_receipt" | "no_receipt" | null;
  cardCurrency?: string;
  cardAmount?: number;
  additionalInfo?: string | null;
  specificCountry?: string | null;
  images?: { filename: string; mime: string; base64: string }[];
  idempotencyKey?: string;
};

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as SellBody;

    if (!body.slug?.trim()) {
      return NextResponse.json({ error: "Select a gift card brand" }, { status: 400 });
    }
    if (!body.cardCountry?.trim()) {
      return NextResponse.json({ error: "Select the card country" }, { status: 400 });
    }
    if (!body.cardType) {
      return NextResponse.json({ error: "Select card type" }, { status: 400 });
    }
    if (!body.cardCurrency?.trim()) {
      return NextResponse.json({ error: "Select card currency" }, { status: 400 });
    }
    const cardAmount = Number(body.cardAmount);
    if (!Number.isFinite(cardAmount) || cardAmount <= 0) {
      return NextResponse.json({ error: "Enter a valid card amount" }, { status: 400 });
    }

    // Cap image payload size (~4MB total base64)
    const images = (body.images || []).slice(0, 5).filter((img) => {
      return (
        img?.base64 &&
        img.base64.length < 3_500_000 &&
        typeof img.filename === "string"
      );
    });

    const result = await sellGiftCard({
      userId: user.id,
      countryCode: user.countryCode,
      slug: body.slug.trim().toLowerCase(),
      brandName: body.brandName,
      cardCountry: body.cardCountry.trim().toUpperCase(),
      cardType: body.cardType,
      subType: body.subType,
      cardCurrency: body.cardCurrency.trim().toUpperCase(),
      cardAmount,
      additionalInfo: body.additionalInfo,
      images,
      specificCountry: body.specificCountry,
      idempotencyKey: body.idempotencyKey || randomUUID(),
    });

    try {
      await createNotification({
        userId: user.id,
        title:
          result.status === "completed"
            ? "Gift card sold"
            : "Gift card submitted",
        body:
          result.status === "completed"
            ? `${formatMoney(result.amount, result.currency)} credited to your wallet.`
            : `Trade ${result.reference} is under review.`,
        type: "gift_card",
        metadata: {
          href:
            result.status === "completed"
              ? `/history/${result.transactionId}`
              : "/services/gift-cards",
          transactionId: result.transactionId,
          reference: result.reference,
        },
      });
    } catch (e) {
      console.error("[sogo-sell-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
      status: result.status,
      reference: result.reference,
      localReference: result.localReference,
      transactionId: result.transactionId,
      amount: result.amount,
      amountFormatted: formatMoney(result.amount, result.currency),
      currency: result.currency,
      wallet: result.wallet,
      message: result.message,
    });
  } catch (error) {
    console.error("[sogo-sell]", error);
    return NextResponse.json(
      {
        error: sogoErrorToEnglish(
          error instanceof Error ? error.message : "Failed to sell gift card",
        ),
      },
      { status: 400 },
    );
  }
}
