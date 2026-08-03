import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/jap/status/[id]. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mod = await import("@/app/api/jap/status/[id]/route");
  return mod.GET(req as never, ctx as never);
}
