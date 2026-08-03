import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/vtpass/services/route. */

export async function GET(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/vtpass/services/route");
  return mod.GET(req as never, ctx as never);
}
