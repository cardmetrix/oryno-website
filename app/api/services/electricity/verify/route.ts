import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly alias → /api/vtpass/verify (category: electricity). */

export async function POST(req: NextRequest, ctx: unknown) {
  const mod = await import("@/app/api/vtpass/verify/route");
  return mod.POST(req as never, ctx as never);
}
