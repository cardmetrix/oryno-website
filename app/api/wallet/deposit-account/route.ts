import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import {
  getWalletFundOptions,
  saveDepositIdentity,
} from "@/lib/flutterwave/deposit-accounts";
import { IdentityConflictError } from "@/lib/flutterwave/deposit-identity";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const options = await getWalletFundOptions(user);
    if (!options.account && options.error) {
      return NextResponse.json(
        { error: options.error, ...options },
        { status: 500 },
      );
    }

    return NextResponse.json(options);
  } catch (error) {
    console.error("[deposit-account-get]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load deposit account",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      idType?: string;
      idNumber?: string;
    };

    const idType = body.idType?.trim().toUpperCase();
    if (idType === "BVN" || idType === "NIN") {
      if (!body.idNumber?.trim()) {
        return NextResponse.json(
          { error: `${idType} is required.` },
          { status: 400 },
        );
      }
      await saveDepositIdentity(user.id, {
        idType,
        idNumber: body.idNumber,
      });
    }

    const options = await getWalletFundOptions(user);
    if (!options.account && options.identityRequired) {
      return NextResponse.json(
        {
          error: options.identityRequired.message,
          ...options,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...options,
    });
  } catch (error) {
    console.error("[deposit-account-post]", error);
    if (error instanceof IdentityConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create deposit account",
      },
      { status: 500 },
    );
  }
}
