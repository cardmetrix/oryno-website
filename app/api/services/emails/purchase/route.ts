import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import {
  anymessageErrorToEnglish,
  purchaseEmailActivation,
} from "@/lib/anymessage";
import { publicServiceError } from "@/lib/service-errors";
import { actionLockHttpStatus } from "@/lib/wallet/action-lock";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      site?: string;
      domain?: string;
      costUsd?: number;
      priceUsd?: number;
      priceLocal?: number;
    };

    if (!body.site?.trim() || !body.domain?.trim()) {
      return NextResponse.json(
        { error: "Site and domain are required" },
        { status: 400 },
      );
    }

    const { withSpendLock } = await import("@/lib/wallet/action-lock");
    const result = await withSpendLock(
      user.id,
      Number(body.priceLocal) || 0,
      user.countryCode,
      () =>
        purchaseEmailActivation({
          userId: user.id,
          countryCode: user.countryCode,
          site: body.site!.trim(),
          domain: body.domain!.trim(),
          costUsd: Number(body.costUsd) || undefined,
          priceUsd: Number(body.priceUsd) || 0.05,
          priceLocal: Number(body.priceLocal) || undefined,
        }),
    );

    const amountFormatted = formatMoney(result.amount, result.currency);

    try {
      await createNotification({
        userId: user.id,
        title: "Email reserved",
        body: `${result.email} is ready for ${result.site}`,
        type: "email",
        metadata: {
          href: "/services/emails",
          emailId: result.emailId,
          transactionId: result.transactionId,
          provider: "anymessage",
        },
      });
    } catch (e) {
      console.error("[anymessage-email-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
      provider: "anymessage",
      email: result.email,
      emailId: result.emailId,
      site: result.site,
      domain: result.domain,
      transactionId: result.transactionId,
      wallet: result.wallet,
      amountFormatted,
      message: "Email reserved — watch inbox for codes",
    });
  } catch (error) {
    console.error("[rent-email-purchase]", error);
    const raw =
      error instanceof Error ? error.message : "Failed to rent email";
    const errorMessage = publicServiceError(anymessageErrorToEnglish(raw));
    return NextResponse.json(
      {
        error: errorMessage,
        code: actionLockHttpStatus(error)
          ? "action_in_progress"
          : "PURCHASE_FAILED",
      },
      { status: actionLockHttpStatus(error) || 400 },
    );
  }
}
