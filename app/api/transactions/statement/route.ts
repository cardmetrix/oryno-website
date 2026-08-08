import { NextResponse } from "next/server";

import { ensureAppUser } from "@/lib/auth/current-user";
import {
  emailWalletStatement,
  type StatementFormat,
} from "@/lib/transactions/statement";

export const runtime = "nodejs";

type Body = {
  format?: StatementFormat | string;
  month?: string | null;
};

export async function POST(request: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.email?.trim()) {
      return NextResponse.json(
        { error: "Your account has no email address on file." },
        { status: 400 },
      );
    }

    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      body = {};
    }

    const format: StatementFormat =
      body.format === "xlsx" || body.format === "excel" ? "xlsx" : "pdf";
    const month =
      typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month)
        ? body.month
        : null;

    const result = await emailWalletStatement(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      { format, month },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[transactions-statement]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to email wallet statement",
      },
      { status: 500 },
    );
  }
}
