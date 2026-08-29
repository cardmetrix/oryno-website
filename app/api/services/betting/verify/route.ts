import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const mod = await import("@/app/api/betting/verify/route");
  return mod.POST(req);
}
