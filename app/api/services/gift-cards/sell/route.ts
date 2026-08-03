import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/sogo/sell/route. */

export async function POST(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/sogo/sell/route");
  return mod.POST(req as never, ctx as never);
}
