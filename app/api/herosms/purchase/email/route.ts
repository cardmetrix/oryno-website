import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import { herosmsErrorToEnglish, purchaseEmailActivation } from "@/lib/herosms";

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
      service?: string;
      priceUsd?: number;
      priceLocal?: number;
    };

    if (!body.site?.trim() || !body.domain?.trim()) {
      return NextResponse.json(
        { error: "Site and domain are required" },
        { status: 400 },
      );
    }

    console.log("[herosms-purchase-email] request", {
      site: body.site,
      domain: body.domain,
      service: body.service,
      priceUsd: body.priceUsd,
    });

    const result = await purchaseEmailActivation({
      userId: user.id,
      countryCode: user.countryCode,
      site: body.site.trim(),
      domain: body.domain.trim(),
      service: body.service,
      priceUsd: Number(body.priceUsd) || 0.1,
      priceLocal: Number(body.priceLocal) || undefined,
    });

    console.log("[herosms-purchase-email] ok", {
      simulated: result.simulated,
      emailId: result.emailId,
      email: result.email,
    });

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
        },
      });
    } catch (e) {
      console.error("[herosms-email-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
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
    console.error("[herosms-purchase-email]", error);
    const raw =
      error instanceof Error ? error.message : "Failed to rent email";
    return NextResponse.json(
      { error: herosmsErrorToEnglish(raw) },
      { status: 400 },
    );
  }
}
