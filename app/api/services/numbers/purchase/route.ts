import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/herosms/purchase/number/route. */

export async function POST(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/herosms/purchase/number/route");
  return mod.POST(req as never, ctx as never);
}
