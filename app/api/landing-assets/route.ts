import { NextResponse } from "next/server";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { getLandingAssetMap } from "@/lib/landing/seed";
import { LANDING_ASSET_SLOTS } from "@/lib/landing/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public map of landing / auth image slots → URLs (falls back to bundled defaults). */
export async function GET() {
  try {
    await ensureWalletSchema();
    const assets = await getLandingAssetMap();
    return NextResponse.json({
      ok: true,
      assets,
      slots: LANDING_ASSET_SLOTS.map((s) => s.slot),
    });
  } catch (error) {
    console.error("[landing-assets-get]", error);
    const assets: Record<string, string> = {};
    for (const s of LANDING_ASSET_SLOTS) assets[s.slot] = s.defaultPath;
    return NextResponse.json({ ok: true, assets, slots: LANDING_ASSET_SLOTS.map((s) => s.slot) });
  }
}
