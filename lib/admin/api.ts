import { NextResponse } from "next/server";
import { requireAdminApi, type AdminRecord } from "@/lib/admin/auth";

export async function withAdminApi(
  handler: (ctx: { admin: AdminRecord }) => Promise<NextResponse> | NextResponse,
) {
  const gate = await requireAdminApi();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  try {
    return await handler({ admin: gate.admin });
  } catch (error) {
    console.error("[admin-api]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Admin request failed",
      },
      { status: 500 },
    );
  }
}

export function titleCaseStatus(value: string) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
