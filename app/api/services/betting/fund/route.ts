import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const mod = await import("@/app/api/betting/fund/route");
  return mod.POST(req);
}
