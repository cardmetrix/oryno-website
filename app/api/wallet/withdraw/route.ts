import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Withdrawals removed — use Convert or Cards instead. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Withdrawals are no longer available on ORYNO.",
      code: "withdrawals_removed",
    },
    { status: 410 },
  );
}

export async function GET() {
  return POST();
}
