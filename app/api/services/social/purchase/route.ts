import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/jap/purchase/route. */

export async function POST(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/jap/purchase/route");
  return mod.POST(req as never, ctx as never);
}
