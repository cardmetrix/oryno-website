import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { currencyForCountry, resolveCountryCode } from "@/lib/country";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { userBankAccounts } from "@/lib/db/schema";
import {
  createOrReuseTransferRecipient,
  listPaystackBanks,
  resolveBankAccount,
} from "@/lib/paystack/banks";
import { isPaystackDemoMode } from "@/lib/paystack/client";
import {
  accountNumberRules,
  addBankInstructions,
} from "@/lib/paystack/country";
import { listBankAccounts, toBankSummary } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureWalletSchema();
    const countryCode = resolveCountryCode(user.countryCode);
    const [banks, options] = await Promise.all([
      listBankAccounts(user.id),
      listPaystackBanks(countryCode),
    ]);

    return NextResponse.json({
      banks: banks.map(toBankSummary),
      options: options.map((b) => ({
        name: b.name,
        code: b.code,
        type: b.type,
      })),
      countryCode,
      currency: currencyForCountry(countryCode),
      accountRules: accountNumberRules(countryCode),
      instructions: addBankInstructions(countryCode),
      demoMode: isPaystackDemoMode(),
    });
  } catch (error) {
    console.error("[wallet-banks-get]", error);
    return NextResponse.json(
      { error: "Failed to load bank accounts" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureWalletSchema();
    const countryCode = resolveCountryCode(user.countryCode);
    const currency = currencyForCountry(countryCode);
    const rules = accountNumberRules(countryCode);

    const body = (await req.json()) as {
      bankCode?: string;
      bankName?: string;
      accountName?: string;
      accountNumber?: string;
      makePrimary?: boolean;
    };

    const bankCode = (body.bankCode ?? "").trim();
    const accountNumber = (body.accountNumber ?? "").replace(/\D/g, "");

    if (!bankCode) {
      return NextResponse.json(
        { error: "Select a bank" },
        { status: 400 },
      );
    }
    if (accountNumber.length < rules.min) {
      return NextResponse.json(
        { error: `Enter a valid ${rules.label.toLowerCase()}` },
        { status: 400 },
      );
    }

    const resolved = await resolveBankAccount({
      accountNumber,
      bankCode,
      countryCode,
    });

    const accountName =
      (body.accountName ?? "").trim() || resolved.accountName;
    if (!accountName) {
      return NextResponse.json(
        {
          error:
            resolved.message ||
            "Enter the account name as it appears on your bank or mobile-money wallet",
        },
        { status: 400 },
      );
    }

    const recipient = await createOrReuseTransferRecipient({
      accountName,
      accountNumber: resolved.accountNumber,
      bankCode,
      currency,
      countryCode,
      type: resolved.type,
    });

    const bankName =
      recipient.bankName ||
      resolved.bankName ||
      (body.bankName ?? "").trim() ||
      "Bank";

    const existing = await listBankAccounts(user.id);
    const makePrimary = body.makePrimary || existing.length === 0;

    if (makePrimary && existing.length) {
      await db
        .update(userBankAccounts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(userBankAccounts.userId, user.id));
    }

    const [created] = await db
      .insert(userBankAccounts)
      .values({
        userId: user.id,
        bankName,
        bankCode,
        accountName: recipient.accountName || accountName,
        accountNumber: resolved.accountNumber.slice(0, 32),
        paystackRecipientCode: recipient.recipientCode,
        isPrimary: makePrimary,
        verified: true,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      bank: toBankSummary(created),
      demoMode: isPaystackDemoMode(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.includes("unique")
          ? "This account number is already saved"
          : error.message
        : "Failed to add bank account";
    console.error("[wallet-banks-post]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      id?: string;
      makePrimary?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Missing bank id" }, { status: 400 });
    }

    const account = await db.query.userBankAccounts.findFirst({
      where: and(
        eq(userBankAccounts.id, body.id),
        eq(userBankAccounts.userId, user.id),
      ),
    });
    if (!account) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    if (body.makePrimary) {
      await db
        .update(userBankAccounts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(userBankAccounts.userId, user.id));
      await db
        .update(userBankAccounts)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(userBankAccounts.id, account.id));
    }

    const banks = await listBankAccounts(user.id);
    return NextResponse.json({ ok: true, banks: banks.map(toBankSummary) });
  } catch (error) {
    console.error("[wallet-banks-patch]", error);
    return NextResponse.json(
      { error: "Failed to update bank account" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing bank id" }, { status: 400 });
    }

    await db
      .delete(userBankAccounts)
      .where(
        and(
          eq(userBankAccounts.id, id),
          eq(userBankAccounts.userId, user.id),
        ),
      );

    const remaining = await listBankAccounts(user.id);
    if (remaining.length && !remaining.some((b) => b.isPrimary)) {
      await db
        .update(userBankAccounts)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(userBankAccounts.id, remaining[0].id));
    }

    const banks = await listBankAccounts(user.id);
    return NextResponse.json({ ok: true, banks: banks.map(toBankSummary) });
  } catch (error) {
    console.error("[wallet-banks-delete]", error);
    return NextResponse.json(
      {
        error:
          "Failed to remove bank account. It may be linked to a withdrawal.",
      },
      { status: 400 },
    );
  }
}
