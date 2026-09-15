import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import {
  fivesimErrorToEnglish,
  numbersProvider,
  pollFivesimNumberStatus,
} from "@/lib/fivesim";
import { pollNumberStatus, herosmsErrorToEnglish } from "@/lib/herosms";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.externalRef, id.slice(0, 120)),
    });
    const meta = (tx?.metadata || {}) as Record<string, unknown>;
    const storedProvider =
      meta.provider === "fivesim" || meta.provider === "herosms"
        ? meta.provider
        : null;
    const provider = storedProvider || numbersProvider();

    if (provider === "fivesim") {
      const status = await pollFivesimNumberStatus(id, user.id);
      return NextResponse.json({ ok: true, ...status });
    }

    const status = await pollNumberStatus(id, user.id);
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    console.error("[numbers-status]", error);
    const provider = numbersProvider();
    return NextResponse.json(
      {
        error:
          provider === "fivesim"
            ? fivesimErrorToEnglish(
                error instanceof Error ? error.message : "Failed to get status",
              )
            : herosmsErrorToEnglish(
                error instanceof Error ? error.message : "Failed to get status",
              ),
      },
      { status: 400 },
    );
  }
}
