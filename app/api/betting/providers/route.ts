import { NextResponse } from "next/server";
import {
  BETTING_AMOUNT_PRESETS,
  BETTING_PROVIDERS,
  DEMO_BETTING_CUSTOMERS,
  isBettingDemoMode,
} from "@/lib/betting";

export const runtime = "nodejs";

export async function GET() {
  const demo = isBettingDemoMode();
  return NextResponse.json({
    ok: true,
    demo,
    provider: demo ? "demo" : "vtu-africa",
    services: BETTING_PROVIDERS,
    presets: BETTING_AMOUNT_PRESETS,
    demoTests: demo
      ? DEMO_BETTING_CUSTOMERS.map((c) => ({
          customerId: c.customerId,
          name: c.name,
          outcome: c.outcome,
          note: c.note,
        }))
      : [],
  });
}
