import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/reloadly/countries/route. */

export async function GET(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/reloadly/countries/route");
  return mod.GET(req as never, ctx as never);
}
