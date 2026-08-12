import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { landingAssets } from "@/lib/db/schema";
import { shapeLandingAsset } from "@/lib/landing/assets";
import { ensureLandingAssets } from "@/lib/landing/seed";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    try {
      await ensureLandingAssets();
    } catch {
      // continue
    }

    const rows = await db
      .select()
      .from(landingAssets)
      .orderBy(asc(landingAssets.sortOrder));

    return NextResponse.json({
      ok: true,
      assets: rows.map(shapeLandingAsset),
    });
  });
}
