import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/sogo/rates/route. */

export async function GET(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/sogo/rates/route");
  return mod.GET(req as never, ctx as never);
}
