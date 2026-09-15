import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/services/numbers/prices/route");
  return mod.GET(req as never, ctx as never);
}
