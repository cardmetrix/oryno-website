import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  bettingErrorToEnglish,
  bettingHttpStatus,
  findBettingProvider,
  normalizeBettingCustomerId,
  verifyBettingCustomer,
} from "@/lib/betting";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      serviceID?: string;
      customerRef?: string;
      customerId?: string;
      billersCode?: string;
    };

    const serviceID = (body.serviceID || "").trim();
    const customerRef = normalizeBettingCustomerId(
      body.customerRef || body.customerId || body.billersCode || "",
    );
    const provider = findBettingProvider(serviceID);

    if (!provider || customerRef.length < 6) {
      return NextResponse.json(
        { error: "Enter a betting company and account ID" },
        { status: 400 },
      );
    }

    const result = await verifyBettingCustomer({
      serviceID: provider.serviceID,
      customerId: customerRef,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message || "Could not verify betting account" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      demo: result.demo,
      customerName: result.customerName,
      customerId: customerRef,
      provider: provider.serviceID,
      providerName: provider.name,
    });
  } catch (error) {
    console.error("[betting-verify]", error);
    return NextResponse.json(
      {
        error: bettingErrorToEnglish(
          error instanceof Error ? error.message : "Verification failed",
        ),
      },
      { status: bettingHttpStatus(error) },
    );
  }
}
