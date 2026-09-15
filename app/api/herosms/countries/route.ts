import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Legacy path — numbers/emails are 5sim-only under /api/services/*. */
export async function GET(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/services/numbers/countries/route");
  return mod.GET(req as never, ctx as never);
}
