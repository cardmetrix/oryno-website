import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mod = await import("@/app/api/services/numbers/status/[id]/route");
  return mod.GET(req as never, ctx as never);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const mod = await import("@/app/api/services/numbers/status/[id]/route");
  return mod.DELETE(req as never, ctx as never);
}
