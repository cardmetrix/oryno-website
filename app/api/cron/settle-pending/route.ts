import { NextResponse } from "next/server";
import { settleStuckDebits } from "@/lib/wallet/settle-pending";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await settleStuckDebits();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron-settle-pending]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settle failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
