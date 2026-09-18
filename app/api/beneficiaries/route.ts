import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { listBeneficiaries } from "@/lib/beneficiaries";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await listBeneficiaries(user.id);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("[beneficiaries-get]", error);
    return NextResponse.json(
      { error: "Failed to load beneficiaries" },
      { status: 500 },
    );
  }
}
