import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getUserInvoice } from "@/lib/invoices";
import { buildInvoicePdf } from "@/lib/invoices/pdf";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const packed = await getUserInvoice(user.id, id);
    if (!packed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pdf = await buildInvoicePdf({
      invoice: packed.invoice,
      items: packed.items,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${packed.invoice.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[invoice-pdf]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate PDF",
      },
      { status: 500 },
    );
  }
}
