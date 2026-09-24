import { NextResponse } from "next/server";
import { getServicesDirectory } from "@/lib/services-directory";
import {
  getEnabledServiceFlags,
  isServiceEnabledForFlags,
} from "@/lib/services/enabled-for-country";

export const runtime = "nodejs";

/** Lightweight catalog for the All Services page. */
export async function GET(req: Request) {
  const country = new URL(req.url).searchParams.get("country");
  const flags = await getEnabledServiceFlags(country);
  const services = getServicesDirectory(country)
    .filter((s) => isServiceEnabledForFlags(s.id, flags))
    .map((s) => ({
      id: s.id,
      href: s.href,
      label: s.label,
      shortDescription: s.shortDescription,
      longDescription: s.longDescription,
      category: s.category,
      tags: s.tags,
      eta: s.eta,
      accent: s.accent,
      popular: Boolean(s.popular),
      soon: Boolean(s.soon),
      stats: s.stats ?? null,
      icon: s.id,
      wallet: s.id === "gift-cards" || s.id === "virtual-numbers" || s.id === "social"
        ? "USD"
        : "local",
    }));

  return NextResponse.json(
    { services, count: services.length, enabledServices: flags },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
