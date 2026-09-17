import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly alias → /api/vtpass/purchase/bill/status (token polling). */

export async function GET(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/vtpass/purchase/bill/status/route");
  return mod.GET(req as never, ctx as never);
}
