import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { assertAdminRole, writeAdminAudit } from "@/lib/admin/auth";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import {
  listInternationalGiftingWaitlist,
  notifyInternationalGiftingWaitlist,
  removeInternationalGiftingWaitlistEntries,
} from "@/lib/waitlist/international-gifting";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const entries = await listInternationalGiftingWaitlist();
    const notifiedCount = entries.filter((e) => e.notifiedAt).length;
    return NextResponse.json({
      count: entries.length,
      notifiedCount,
      pendingNotifyCount: entries.length - notifiedCount,
      entries,
    });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async ({ admin }) => {
    await assertAdminRole(admin);
    await ensureWalletSchema();

    const body = (await req.json().catch(() => ({}))) as {
      action?: "notify";
      ids?: string[];
      title?: string;
      body?: string;
      onlyUnnotified?: boolean;
    };

    if (body.action !== "notify") {
      return NextResponse.json(
        { error: "action must be notify" },
        { status: 400 },
      );
    }

    const result = await notifyInternationalGiftingWaitlist({
      ids: body.ids,
      title: body.title,
      body: body.body,
      onlyUnnotified: body.onlyUnnotified,
    });

    await writeAdminAudit({
      adminId: admin.id,
      action: "international_gifting_waitlist.notify",
      entityType: "gift_card_waitlist",
      entityId: body.ids?.join(",") || "all",
      meta: result,
    });

    return NextResponse.json({ ok: true, ...result });
  });
}

export async function DELETE(req: Request) {
  return withAdminApi(async ({ admin }) => {
    await assertAdminRole(admin);
    await ensureWalletSchema();

    const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
    if (!body.ids?.length) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const result = await removeInternationalGiftingWaitlistEntries(body.ids);

    await writeAdminAudit({
      adminId: admin.id,
      action: "international_gifting_waitlist.remove",
      entityType: "gift_card_waitlist",
      entityId: body.ids.join(","),
      meta: result,
    });

    return NextResponse.json({ ok: true, ...result });
  });
}
