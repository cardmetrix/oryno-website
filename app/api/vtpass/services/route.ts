import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { isSogoDemoMode, listSogoBillServices } from "@/lib/sogo";
import type { VtpassServiceCategory } from "@/lib/vtpass";

export const runtime = "nodejs";

const ALLOWED: VtpassServiceCategory[] = [
  "airtime",
  "data",
  "tv-subscription",
  "electricity-bill",
];

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const identifier = (searchParams.get("identifier") ||
      "airtime") as VtpassServiceCategory;

    if (!ALLOWED.includes(identifier)) {
      return NextResponse.json(
        { error: "Invalid service category" },
        { status: 400 },
      );
    }

    const services = await listSogoBillServices(identifier);

    return NextResponse.json({
      ok: true,
      demo: isSogoDemoMode(),
      provider: "sogo",
      identifier,
      services: services.map((s) => ({
        serviceID: s.slug,
        name: s.name,
        image: s.image ?? null,
      })),
    });
  } catch (error) {
    console.error("[sogo-bills-services]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load services",
      },
      { status: 400 },
    );
  }
}
