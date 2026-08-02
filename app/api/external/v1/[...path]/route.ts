import { NextResponse, type NextRequest } from "next/server";
import { applyCorsHeaders } from "@/lib/external/cors";

export const runtime = "nodejs";

/**
 * Fallback only — middleware normally rewrites /api/external/v1/* → /api/*.
 * If a request reaches this handler, rewriting did not run.
 */
async function fallback(request: NextRequest) {
  console.warn(
    "[external-api] catch-all hit without middleware rewrite",
    request.nextUrl.pathname,
  );
  const res = NextResponse.json(
    {
      error:
        "External API rewrite missing. Ensure middleware rewrite is deployed.",
    },
    { status: 503 },
  );
  applyCorsHeaders(res.headers, request);
  return res;
}

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(res.headers, request);
  return res;
}

export const GET = fallback;
export const POST = fallback;
export const PUT = fallback;
export const PATCH = fallback;
export const DELETE = fallback;
