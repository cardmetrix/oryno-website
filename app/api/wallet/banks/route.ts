import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { userBankAccounts } from "@/lib/db/schema";
import {
  DEMO_BANKS,
  listBankAccounts,
  toBankSummary,
} from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const banks = await listBankAccounts(user.id);
    return NextResponse.json({
      banks: banks.map(toBankSummary),
      options: DEMO_BANKS,
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

    const body = (await req.json()) as {
      bankName?: string;
      accountName?: string;
      accountNumber?: string;
      makePrimary?: boolean;
    };

    const bankName = (body.bankName ?? "").trim();
    const accountName = (body.accountName ?? "").trim();
    const accountNumber = (body.accountNumber ?? "").replace(/\D/g, "");

    if (!bankName || !accountName) {
      return NextResponse.json(
        { error: "Bank name and account name are required" },
        { status: 400 },
      );
    }
    if (accountNumber.length < 10) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit account number" },
        { status: 400 },
      );
    }

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
        accountName,
        accountNumber: accountNumber.slice(0, 10),
        isPrimary: makePrimary,
        verified: true,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      bank: toBankSummary(created),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("unique")
        ? "This account number is already saved"
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
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
      { error: "Failed to remove bank account. It may be linked to a withdrawal." },
      { status: 400 },
    );
  }
}
