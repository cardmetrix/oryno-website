import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getDisplayFx } from "@/lib/display-currency";
import {
  groupTransactionsByDate,
  toAppTransaction,
} from "@/lib/transactions";
import { scheduleUserBackgroundSettle } from "@/lib/wallet/background-settle";
import { listTransactionRows } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    scheduleUserBackgroundSettle(user.id, "quick");

    const [rows, displayFx] = await Promise.all([
      listTransactionRows(user.id, 100),
      getDisplayFx(user.countryCode),
    ]);
    const items = rows.map((row) =>
      toAppTransaction({ ...row, metadata: null }, displayFx),
    );

    return NextResponse.json({
      items,
      groups: groupTransactionsByDate(items),
      count: items.length,
    });
  } catch (error) {
    console.error("[transactions-get]", error);
    return NextResponse.json(
      { error: "Failed to load transactions" },
      { status: 500 },
    );
  }
}
