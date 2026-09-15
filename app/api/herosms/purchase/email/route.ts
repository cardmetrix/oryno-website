import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/services/emails/purchase/route");
  return mod.POST(req as never, ctx as never);
}
