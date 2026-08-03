import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/vtpass/purchase/bill/route. */

export async function POST(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/vtpass/purchase/bill/route");
  return mod.POST(req as never, ctx as never);
}
