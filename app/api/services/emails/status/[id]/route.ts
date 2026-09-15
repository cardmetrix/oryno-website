import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Friendly mobile alias → /api/herosms/status/email/[id]. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mod = await import("@/app/api/herosms/status/email/[id]/route");
  return mod.GET(req as never, ctx as never);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mod = await import("@/app/api/herosms/status/email/[id]/route");
  return mod.DELETE(req as never, ctx as never);
}
