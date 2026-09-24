import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { assertAdminRole, writeAdminAudit } from "@/lib/admin/auth";
import { ensureVirtualCardsSchema } from "@/lib/db/ensure-schema";
import {
  listAdminVirtualCardOrders,
  reviewVirtualCardOrder,
} from "@/lib/virtual-cards";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    await ensureVirtualCardsSchema();
    const orders = await listAdminVirtualCardOrders();
    const pending = orders.filter((o) => o.status === "paid_pending_review");
    return NextResponse.json({
      ok: true,
      pendingCount: pending.length,
      orders,
    });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async ({ admin }) => {
    await assertAdminRole(admin);
    await ensureVirtualCardsSchema();

    const body = (await req.json().catch(() => ({}))) as {
      orderId?: string;
      action?: "approve" | "reject";
      note?: string;
    };

    if (!body.orderId || (body.action !== "approve" && body.action !== "reject")) {
      return NextResponse.json(
        { error: "orderId and action (approve|reject) required" },
        { status: 400 },
      );
    }

    const result = await reviewVirtualCardOrder({
      orderId: body.orderId,
      adminUserId: admin.id,
      action: body.action,
      note: body.note,
    });

    await writeAdminAudit({
      adminId: admin.id,
      action:
        body.action === "approve"
          ? "virtual_card.approve"
          : "virtual_card.reject",
      entityType: "usd_virtual_card_order",
      entityId: body.orderId,
      meta: { note: body.note ?? null },
    });

    return NextResponse.json({ ok: true, ...result });
  });
}
