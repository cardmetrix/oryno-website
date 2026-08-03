import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Lightweight deploy probe for mobile troubleshooting. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "oryno-website",
    authFix: "verifyToken-legacy-sub-v2",
    hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
    hasClerkJwtKey: Boolean(process.env.CLERK_JWT_KEY?.trim()),
    publishableKeyPrefix:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.slice(0, 12) ?? null,
    time: new Date().toISOString(),
  });
}
