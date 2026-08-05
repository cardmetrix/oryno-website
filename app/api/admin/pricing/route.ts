import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import {
  bulkAdjustProvider,
  deletePriceOverride,
  getServicePricingConfig,
  listPriceOverrides,
  saveServicePricingConfig,
  upsertPriceOverride,
} from "@/lib/pricing/service-pricing";
import {
  DEFAULT_SERVICE_PRICING,
  PRICING_PROVIDERS,
  type OverrideMode,
  type PricingProvider,
  type ServicePricingConfig,
} from "@/lib/pricing/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") as PricingProvider | null;
    const [config, overrides] = await Promise.all([
      getServicePricingConfig(true),
      listPriceOverrides(
        provider && PRICING_PROVIDERS.includes(provider)
          ? provider
          : undefined,
      ),
    ]);

    return NextResponse.json({
      ok: true,
      config,
      defaults: DEFAULT_SERVICE_PRICING,
      providers: PRICING_PROVIDERS,
      overrides,
      modes: [
        {
          id: "percent",
          label: "Percent adjust",
          hint: "+10 = +10% on default retail; -5 = 5% discount",
        },
        {
          id: "markup",
          label: "Markup multiplier",
          hint: "1.25 = +25% on provider/FX cost (replaces group markup for this SKU)",
        },
        {
          id: "fixed",
          label: "Fixed local price",
          hint: "Exact amount charged in the user’s local currency",
        },
      ],
    });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async ({ admin }) => {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      config?: ServicePricingConfig;
      provider?: PricingProvider;
      percent?: number;
      override?: {
        provider: PricingProvider;
        serviceKey: string;
        label?: string;
        mode: OverrideMode;
        value: number;
        active?: boolean;
      };
      deleteOverrideId?: string;
    };

    if (body.action === "save_config" && body.config) {
      const config = await saveServicePricingConfig(body.config);
      await writeAdminAudit({
        adminId: admin.id,
        action: "pricing.config_update",
        entityType: "service_pricing",
        entityId: "service_pricing",
        meta: { providers: Object.keys(config.providers) },
      });
      return NextResponse.json({ ok: true, config });
    }

    if (
      body.action === "bulk_percent" &&
      body.provider &&
      typeof body.percent === "number"
    ) {
      const config = await bulkAdjustProvider({
        provider: body.provider,
        percent: body.percent,
      });
      await writeAdminAudit({
        adminId: admin.id,
        action: "pricing.bulk_percent",
        entityType: "service_pricing",
        entityId: body.provider,
        meta: { percent: body.percent },
      });
      return NextResponse.json({ ok: true, config });
    }

    if (body.action === "upsert_override" && body.override) {
      const override = await upsertPriceOverride(body.override);
      await writeAdminAudit({
        adminId: admin.id,
        action: "pricing.override_upsert",
        entityType: "service_price_override",
        entityId: override.id,
        meta: {
          provider: override.provider,
          serviceKey: override.serviceKey,
          mode: override.mode,
          value: override.value,
        },
      });
      return NextResponse.json({ ok: true, override });
    }

    if (body.action === "delete_override" && body.deleteOverrideId) {
      const removed = await deletePriceOverride(body.deleteOverrideId);
      await writeAdminAudit({
        adminId: admin.id,
        action: "pricing.override_delete",
        entityType: "service_price_override",
        entityId: body.deleteOverrideId,
      });
      return NextResponse.json({ ok: true, removed });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  });
}
