import { NextResponse } from "next/server";
import { EXTERNAL_API_CATALOG } from "@/lib/external/catalog";
import { applyCorsHeaders } from "@/lib/external/cors";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(res.headers, request);
  return res;
}

/** Catalog + health for the mobile / external API. */
export async function GET(request: NextRequest) {
  console.log("[external-api] GET /api/external/v1 catalog");
  const res = NextResponse.json({
    ok: true,
    ...EXTERNAL_API_CATALOG,
  });
  applyCorsHeaders(res.headers, request);
  return res;
}
