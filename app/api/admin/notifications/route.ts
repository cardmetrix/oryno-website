import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { notificationCampaigns, notifications } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const campaigns = await db
      .select()
      .from(notificationCampaigns)
      .orderBy(desc(notificationCampaigns.createdAt))
      .limit(40);

    const recent = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        type: notifications.type,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return NextResponse.json({
      ok: true,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        audience: c.audience,
        status: titleCaseStatus(c.status),
        when: c.sentAt
          ? new Date(c.sentAt).toLocaleString("en-NG")
          : c.scheduledAt
            ? new Date(c.scheduledAt).toLocaleString("en-NG")
            : "—",
      })),
      recent: recent.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        when: n.createdAt
          ? new Date(n.createdAt).toLocaleString("en-NG")
          : "—",
      })),
    });
  });
}
