import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getServicesDirectory } from "@/lib/services-directory";

export const runtime = "nodejs";

/** Lightweight catalog for the All Services page (fast JSON, no DB). */
export async function GET() {
  const user = await ensureAppUser();
  const services = getServicesDirectory(user?.countryCode).map((s) => ({
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
  }));

  return NextResponse.json(
    { services, count: services.length },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
