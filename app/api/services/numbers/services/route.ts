import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fivesimErrorToEnglish,
  isFivesimLive,
  listFivesimServices,
} from "@/lib/fivesim";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isFivesimLive()) {
      return NextResponse.json(
        {
          error:
            "Virtual numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
        },
        { status: 503 },
      );
    }

    const services = await listFivesimServices();
    return NextResponse.json({
      ok: true,
      demo: false,
      provider: "fivesim",
      services,
    });
  } catch (error) {
    console.error("[numbers-services]", error);
    return NextResponse.json(
      {
        error: fivesimErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load services",
        ),
      },
      { status: 400 },
    );
  }
}
