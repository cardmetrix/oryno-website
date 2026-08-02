import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

export const runtime = "nodejs";

const DEFAULTS = {
  compactTables: true,
  realtimeActivity: true,
  requireAdmin2fa: true,
  freezeHighRiskWallets: true,
  auditLogging: true,
  payoutSla: "5–30 minutes",
  supportEmail: "support@oryno.com",
  defaultCurrencyDisplay: "User local currency",
  giftCardsModule: "Live (Sogo sell + Reloadly buy)",
};

type SettingsValue = typeof DEFAULTS;

async function loadSettings(): Promise<SettingsValue> {
  const row = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "admin_console"),
  });
  if (!row?.value || typeof row.value !== "object") return { ...DEFAULTS };
  return { ...DEFAULTS, ...(row.value as Partial<SettingsValue>) };
}

export async function GET() {
  return withAdminApi(async () => {
    const settings = await loadSettings();
    return NextResponse.json({ ok: true, settings });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async ({ admin }) => {
    const body = (await req.json().catch(() => ({}))) as Partial<SettingsValue>;
    const current = await loadSettings();
    const next: SettingsValue = {
      ...current,
      ...body,
    };

    await db
      .insert(platformSettings)
      .values({
        key: "admin_console",
        value: next,
        description: "Admin console preferences and operational defaults",
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: next,
          updatedAt: new Date(),
        },
      });

    await writeAdminAudit({
      adminId: admin.id,
      action: "settings.update",
      entityType: "platform_settings",
      entityId: "admin_console",
      meta: { keys: Object.keys(body) },
    });

    return NextResponse.json({ ok: true, settings: next });
  });
}
