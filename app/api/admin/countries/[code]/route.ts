import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import {
  countryStatusLabel,
  normalizeCountryCode,
  type CountryStatus,
} from "@/lib/admin/countries";
import { db } from "@/lib/db";
import { countries } from "@/lib/db/schema";

export const runtime = "nodejs";

function isStatus(value: string): value is CountryStatus {
  return value === "live" || value === "beta" || value === "disabled";
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  return withAdminApi(async ({ admin }) => {
    const { code: raw } = await ctx.params;
    const code = normalizeCountryCode(raw);

    const existing = await db.query.countries.findFirst({
      where: eq(countries.code, code),
    });
    if (!existing) {
      return NextResponse.json({ error: "Country not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      status?: string;
      name?: string;
      giftCardsEnabled?: boolean;
      enabledServices?: string[];
      currencySymbol?: string;
      flagEmoji?: string;
    };

    const patch: Partial<typeof countries.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.status != null) {
      if (!isStatus(body.status)) {
        return NextResponse.json(
          { error: "Status must be live, beta (suspended), or disabled" },
          { status: 400 },
        );
      }
      patch.status = body.status;
    }

    if (typeof body.name === "string" && body.name.trim()) {
      patch.name = body.name.trim().slice(0, 120);
    }
    if (typeof body.giftCardsEnabled === "boolean") {
      patch.giftCardsEnabled = body.giftCardsEnabled;
    }
    if (Array.isArray(body.enabledServices)) {
      patch.enabledServices = body.enabledServices
        .map((s) => String(s).trim())
        .filter(Boolean);
    }
    if (typeof body.currencySymbol === "string") {
      patch.currencySymbol = body.currencySymbol.trim().slice(0, 8);
    }
    if (typeof body.flagEmoji === "string") {
      patch.flagEmoji = body.flagEmoji.trim().slice(0, 16) || null;
    }

    const [updated] = await db
      .update(countries)
      .set(patch)
      .where(eq(countries.code, code))
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "country.update",
      entityType: "country",
      entityId: code,
      meta: {
        fromStatus: existing.status,
        toStatus: updated?.status,
        keys: Object.keys(body),
      },
    });

    return NextResponse.json({
      ok: true,
      country: updated
        ? {
            code: updated.code,
            name: updated.name,
            currency: updated.currency,
            status: updated.status,
            statusLabel: countryStatusLabel(updated.status),
            giftCardsEnabled: updated.giftCardsEnabled,
            services: updated.enabledServices || [],
          }
        : null,
    });
  });
}
