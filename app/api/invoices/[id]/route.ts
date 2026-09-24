import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getUserInvoice } from "@/lib/invoices";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await ensureAppUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const packed = await getUserInvoice(user.id, id);
    if (!packed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...packed });
  } catch (error) {
    console.error("[invoice-get]", error);
    return NextResponse.json({ error: "Failed to load invoice" }, { status: 500 });
  }
}
