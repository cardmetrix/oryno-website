import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationCampaigns, users } from "@/lib/db/schema";
import {
  applyTemplateVars,
  getAdminEmailTemplate,
  type AdminEmailTemplateId,
} from "@/lib/admin/email-templates";
import { sendBrandedEmail } from "@/lib/email/send";
import { createNotification } from "@/lib/notifications-service";
import { deliverNotificationPush } from "@/lib/push/deliver";

export type CampaignAudienceMode = "all" | "selected" | "individual";

export type CampaignMeta = {
  mode: CampaignAudienceMode;
  userIds?: string[];
  selectedUsers?: Array<{ id: string; email: string; fullName: string }>;
  individualEmail?: string;
  subject?: string;
  templateId?: AdminEmailTemplateId | string;
  ctaLabel?: string;
  ctaHref?: string;
  notificationType?: string;
  sendInApp?: boolean;
  sendEmail?: boolean;
  stats?: {
    recipients: number;
    emailed: number;
    notified: number;
    failed: number;
  };
};

export type ComposeCampaignInput = {
  title: string;
  body: string;
  subject?: string;
  mode: CampaignAudienceMode;
  userIds?: string[];
  individualEmail?: string;
  templateId?: string;
  ctaLabel?: string;
  ctaHref?: string;
  notificationType?: string;
  sendInApp?: boolean;
  sendEmail?: boolean;
  adminId?: string;
};

const META_START = "@@@ORYNO_META@@@\n";
const META_END = "\n@@@/ORYNO_META@@@\n";

function packBody(body: string, meta: CampaignMeta) {
  return `${META_START}${JSON.stringify(meta)}${META_END}${body}`;
}

function unpackBody(raw: string): { body: string; meta: CampaignMeta } {
  if (!raw.startsWith("@@@ORYNO_META@@@")) {
    return { body: raw, meta: {} as CampaignMeta };
  }
  const end = raw.indexOf(META_END);
  if (end === -1) {
    return { body: raw, meta: {} as CampaignMeta };
  }
  const json = raw.slice(META_START.length, end);
  const body = raw.slice(end + META_END.length);
  try {
    return { body, meta: JSON.parse(json) as CampaignMeta };
  } catch {
    return { body: raw, meta: {} as CampaignMeta };
  }
}

function audienceLabel(input: ComposeCampaignInput, count: number) {
  if (input.mode === "all") return `All users (${count})`;
  if (input.mode === "individual") {
    return input.individualEmail?.trim() || "Individual";
  }
  return `Selected (${count})`;
}

export async function resolveCampaignRecipients(input: ComposeCampaignInput) {
  if (input.mode === "all") {
    return db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
      })
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.email, "")));
  }

  if (input.mode === "individual") {
    const email = input.individualEmail?.trim().toLowerCase();
    if (!email) return [];
    const row = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${email}`,
      columns: { id: true, email: true, fullName: true },
    });
    return row ? [row] : [];
  }

  const ids = [...new Set((input.userIds || []).filter(Boolean))];
  if (ids.length === 0) return [];

  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
    })
    .from(users)
    .where(inArray(users.id, ids));
}

export async function searchCampaignUsers(q: string, limit = 30) {
  const term = q.trim();
  if (!term) {
    return db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
        countryCode: users.countryCode,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);
  }

  const like = `%${term}%`;
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      status: users.status,
      countryCode: users.countryCode,
    })
    .from(users)
    .where(
      or(
        ilike(users.email, like),
        ilike(users.fullName, like),
        ilike(users.phone, like),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

function buildMeta(
  input: ComposeCampaignInput,
  recipients: Array<{ id: string; email: string; fullName: string }>,
  stats?: CampaignMeta["stats"],
): CampaignMeta {
  return {
    mode: input.mode,
    userIds: input.mode === "selected" ? input.userIds || [] : undefined,
    selectedUsers:
      input.mode === "selected"
        ? recipients.map((r) => ({
            id: r.id,
            email: r.email,
            fullName: r.fullName,
          }))
        : undefined,
    individualEmail:
      input.mode === "individual"
        ? input.individualEmail?.trim().toLowerCase()
        : undefined,
    subject: input.subject?.trim() || input.title.trim(),
    templateId: input.templateId || "custom",
    ctaLabel: input.ctaLabel || "Open ORYNO",
    ctaHref: input.ctaHref || "/dashboard",
    notificationType: input.notificationType || "promo",
    sendInApp: input.sendInApp !== false,
    sendEmail: input.sendEmail !== false,
    stats: stats || {
      recipients: recipients.length,
      emailed: 0,
      notified: 0,
      failed: 0,
    },
  };
}

export async function saveCampaignDraft(
  input: ComposeCampaignInput,
  existingId?: string | null,
) {
  const recipients = await resolveCampaignRecipients(input);
  const meta = buildMeta(input, recipients);
  const values = {
    title: input.title.trim().slice(0, 160),
    body: packBody(input.body.trim(), meta),
    audience: audienceLabel(input, recipients.length).slice(0, 120),
    status: "draft" as const,
    createdByAdminId: input.adminId || null,
    updatedAt: new Date(),
  };

  if (existingId) {
    const [row] = await db
      .update(notificationCampaigns)
      .set(values)
      .where(eq(notificationCampaigns.id, existingId))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(notificationCampaigns)
    .values(values)
    .returning();
  return row;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      worker(),
    ),
  );
  return results;
}

export async function sendCampaign(
  input: ComposeCampaignInput & { campaignId?: string | null },
) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error("Title and message body are required");
  }

  const recipients = await resolveCampaignRecipients(input);
  if (recipients.length === 0) {
    throw new Error("No recipients found for this audience");
  }

  const template = getAdminEmailTemplate(input.templateId);
  const subject = (input.subject?.trim() || title).slice(0, 200);
  const ctaLabel = input.ctaLabel?.trim() || template.ctaLabel || "Open ORYNO";
  const ctaHref = input.ctaHref?.trim() || template.ctaHref || "/dashboard";
  const notificationType =
    input.notificationType || template.notificationType || "promo";
  const sendInApp = input.sendInApp !== false;
  const sendEmail = input.sendEmail !== false;

  const outcomes = await mapPool(recipients, 5, async (user) => {
    const personalizedBody = applyTemplateVars(body, {
      name: user.fullName,
      email: user.email,
    });
    const personalizedTitle = applyTemplateVars(title, {
      name: user.fullName,
      email: user.email,
    });
    const personalizedSubject = applyTemplateVars(subject, {
      name: user.fullName,
      email: user.email,
    });

    let emailed = 0;
    let notified = 0;
    let failed = 0;

    try {
      if (sendInApp) {
        await createNotification({
          userId: user.id,
          title: personalizedTitle,
          body: personalizedBody,
          type: notificationType,
          metadata: {
            href: ctaHref,
            kind: "admin_campaign",
            templateId: input.templateId || "custom",
          },
          email: false,
          push: true,
        });
        notified = 1;
      } else if (sendEmail) {
        // Email-only campaign: push without creating a second inbox item.
        void deliverNotificationPush({
          userId: user.id,
          title: personalizedTitle,
          body: personalizedBody,
          type: notificationType,
          href: ctaHref,
        }).catch((error) => console.error("[campaign-push]", error));
      }

      if (sendEmail && user.email) {
        const result = await sendBrandedEmail({
          to: user.email,
          subject: personalizedSubject,
          title: personalizedTitle,
          body: personalizedBody,
          cta: { label: ctaLabel, href: ctaHref },
          footerNote:
            "You’re receiving this message from the ORYNO team. Manage notification preferences in Settings.",
        });
        if (result.ok) emailed = 1;
        else failed = 1;
      }
    } catch (error) {
      failed = 1;
      console.error("[campaign-send]", user.email, error);
    }

    return { emailed, notified, failed };
  });

  const emailed = outcomes.reduce((s, o) => s + o.emailed, 0);
  const notified = outcomes.reduce((s, o) => s + o.notified, 0);
  const failed = outcomes.reduce((s, o) => s + o.failed, 0);

  const meta = buildMeta(input, recipients, {
    recipients: recipients.length,
    emailed,
    notified,
    failed,
  });
  meta.subject = subject;
  meta.ctaLabel = ctaLabel;
  meta.ctaHref = ctaHref;
  meta.notificationType = notificationType;
  meta.sendInApp = sendInApp;
  meta.sendEmail = sendEmail;

  const values = {
    title: title.slice(0, 160),
    body: packBody(body, meta),
    audience: audienceLabel(input, recipients.length).slice(0, 120),
    status: "sent" as const,
    sentAt: new Date(),
    createdByAdminId: input.adminId || null,
    updatedAt: new Date(),
  };

  if (input.campaignId) {
    const [row] = await db
      .update(notificationCampaigns)
      .set(values)
      .where(eq(notificationCampaigns.id, input.campaignId))
      .returning();
    return { campaign: row, stats: meta.stats! };
  }

  const [row] = await db
    .insert(notificationCampaigns)
    .values(values)
    .returning();
  return { campaign: row, stats: meta.stats! };
}

export function serializeCampaign(
  row: typeof notificationCampaigns.$inferSelect,
) {
  const { body, meta } = unpackBody(row.body);
  return {
    id: row.id,
    title: row.title,
    body,
    audience: row.audience,
    status: row.status,
    subject: meta.subject || row.title,
    templateId: meta.templateId || "custom",
    mode: meta.mode || inferMode(row.audience),
    userIds: meta.userIds || [],
    selectedUsers: meta.selectedUsers || [],
    individualEmail: meta.individualEmail || "",
    ctaLabel: meta.ctaLabel || "Open ORYNO",
    ctaHref: meta.ctaHref || "/dashboard",
    notificationType: meta.notificationType || "promo",
    sendInApp: meta.sendInApp !== false,
    sendEmail: meta.sendEmail !== false,
    stats: meta.stats || null,
    when: row.sentAt
      ? new Date(row.sentAt).toLocaleString("en-NG")
      : row.scheduledAt
        ? new Date(row.scheduledAt).toLocaleString("en-NG")
        : new Date(row.createdAt).toLocaleString("en-NG"),
    createdAt: row.createdAt.toISOString(),
  };
}

function inferMode(audience: string): CampaignAudienceMode {
  if (/^all/i.test(audience)) return "all";
  if (/^selected/i.test(audience)) return "selected";
  return "individual";
}
