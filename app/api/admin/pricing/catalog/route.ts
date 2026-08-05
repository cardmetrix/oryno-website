import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { loadAdminPricingCatalog } from "@/lib/pricing/admin-catalog";
import {
  PRICING_PROVIDERS,
  type PricingProvider,
} from "@/lib/pricing/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") as PricingProvider | null;
    if (!provider || !PRICING_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        {
          error: "provider is required",
          providers: PRICING_PROVIDERS,
        },
        { status: 400 },
      );
    }

    const params: Record<string, string | undefined> = {
      platform: searchParams.get("platform") || undefined,
      q: searchParams.get("q") || undefined,
      channel: searchParams.get("channel") || undefined,
      service: searchParams.get("service") || undefined,
      site: searchParams.get("site") || undefined,
      countryCode: searchParams.get("countryCode") || undefined,
      identifier: searchParams.get("identifier") || undefined,
      serviceID: searchParams.get("serviceID") || undefined,
    };

    const catalog = await loadAdminPricingCatalog({ provider, params });
    return NextResponse.json(catalog);
  });
}
