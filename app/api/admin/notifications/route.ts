import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ADMIN_EMAIL_TEMPLATES } from "@/lib/admin/email-templates";
import {
  saveCampaignDraft,
  sendCampaign,
  serializeCampaign,
  type CampaignAudienceMode,
  type ComposeCampaignInput,
} from "@/lib/admin/campaigns";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { notificationCampaigns, notifications, users } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseCompose(
  body: Record<string, unknown>,
  adminId: string,
): ComposeCampaignInput {
  const mode = (String(body.mode || "all") as CampaignAudienceMode) || "all";
  return {
    title: String(body.title || "").trim(),
    body: String(body.body || "").trim(),
    subject: String(body.subject || body.title || "").trim(),
    mode,
    userIds: Array.isArray(body.userIds)
      ? body.userIds.map(String)
      : undefined,
    individualEmail: body.individualEmail
      ? String(body.individualEmail)
      : undefined,
    templateId: body.templateId ? String(body.templateId) : "custom",
    ctaLabel: body.ctaLabel ? String(body.ctaLabel) : undefined,
    ctaHref: body.ctaHref ? String(body.ctaHref) : undefined,
    notificationType: body.notificationType
      ? String(body.notificationType)
      : undefined,
    sendInApp: body.sendInApp !== false,
    sendEmail: body.sendEmail !== false,
    adminId,
  };
}

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

    const [countRow] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.status, "active"));

    return NextResponse.json({
      ok: true,
      templates: ADMIN_EMAIL_TEMPLATES,
      activeUserCount: countRow?.value ?? 0,
      campaigns: campaigns.map((c) => ({
        ...serializeCampaign(c),
        statusLabel: titleCaseStatus(c.status),
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

export async function POST(req: Request) {
  return withAdminApi(async ({ admin }) => {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = String(body.action || "send");
    const compose = parseCompose(body, admin.id);
    const campaignId = body.campaignId ? String(body.campaignId) : null;

    if (action === "load") {
      if (!campaignId) {
        return NextResponse.json(
          { error: "campaignId required" },
          { status: 400 },
        );
      }
      const campaign = await db.query.notificationCampaigns.findFirst({
        where: eq(notificationCampaigns.id, campaignId),
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        ok: true,
        campaign: {
          ...serializeCampaign(campaign),
          statusLabel: titleCaseStatus(campaign.status),
        },
      });
    }

    if (!compose.title || !compose.body) {
      return NextResponse.json(
        { error: "Title and message body are required" },
        { status: 400 },
      );
    }

    if (action === "draft") {
      const campaign = await saveCampaignDraft(compose, campaignId);
      return NextResponse.json({
        ok: true,
        campaign: {
          ...serializeCampaign(campaign),
          statusLabel: titleCaseStatus(campaign.status),
        },
      });
    }

    if (action === "send") {
      const result = await sendCampaign({
        ...compose,
        campaignId,
      });
      return NextResponse.json({
        ok: true,
        stats: result.stats,
        campaign: result.campaign
          ? {
              ...serializeCampaign(result.campaign),
              statusLabel: titleCaseStatus(result.campaign.status),
            }
          : null,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
