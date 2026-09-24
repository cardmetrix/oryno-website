import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import {
  getUsdCardWaitlistStatus,
  joinUsdCardWaitlist,
  leaveUsdCardWaitlist,
} from "@/lib/waitlist/usd-card";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const status = await getUsdCardWaitlistStatus(user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[usd-card-waitlist-get]", error);
    return NextResponse.json(
      { error: "Failed to load waitlist" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.email?.trim()) {
      return NextResponse.json(
        { error: "Add an email to your account to join the waitlist." },
        { status: 400 },
      );
    }
    const result = await joinUsdCardWaitlist({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      countryCode: user.countryCode,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to join waitlist";
    console.error("[usd-card-waitlist-post]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await leaveUsdCardWaitlist(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[usd-card-waitlist-delete]", error);
    return NextResponse.json(
      { error: "Failed to leave waitlist" },
      { status: 400 },
    );
  }
}
