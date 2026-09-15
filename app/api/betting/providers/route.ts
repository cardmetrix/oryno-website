import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  DEMO_BETTING_CUSTOMERS,
  bettingRailForCountry,
  isBettingDemoMode,
  presetsForBettingCountry,
  providersForBettingCountry,
} from "@/lib/betting";
import { convertNgnToLocal } from "@/lib/fx/rates";
import { getDisplayFx } from "@/lib/display-currency";

export const runtime = "nodejs";

export async function GET() {
  const user = await ensureAppUser();
  const countryCode = user?.countryCode || "NG";
  const demo = isBettingDemoMode(countryCode);
  const fx = await getDisplayFx(countryCode);
  const services = providersForBettingCountry(countryCode).map((p) => ({
    ...p,
    minAmount: convertNgnToLocal(p.minAmount, fx.ngnToLocal),
    maxAmount: convertNgnToLocal(p.maxAmount, fx.ngnToLocal),
    currency: fx.to,
  }));

  return NextResponse.json({
    ok: true,
    demo,
    countryCode,
    currency: fx.to,
    provider: demo ? "demo" : bettingRailForCountry(countryCode),
    services,
    presets: presetsForBettingCountry(countryCode),
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
