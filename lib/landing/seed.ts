import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { landingAssets } from "@/lib/db/schema";
import {
  LANDING_ASSET_SLOTS,
  absoluteLandingAssetUrl,
  publicLandingAssetUrl,
  type LandingAssetMap,
  type LandingAssetSlot,
} from "@/lib/landing/assets";

let seeding: Promise<void> | null = null;

/** Ensure every defined landing/auth image slot exists (seeded from current public files). */
export async function ensureLandingAssets() {
  if (!seeding) {
    seeding = (async () => {
      const existing = await db.select({ slot: landingAssets.slot }).from(landingAssets);
      const have = new Set(existing.map((r) => r.slot));
      const missing = LANDING_ASSET_SLOTS.filter((s) => !have.has(s.slot));
      if (!missing.length) return;

      await db.insert(landingAssets).values(
        missing.map((s) => ({
          slot: s.slot,
          label: s.label,
          description: s.description,
          imageUrl: absoluteLandingAssetUrl(s.defaultPath),
          defaultPath: s.defaultPath,
          group: s.group,
          sortOrder: s.sortOrder,
          metadata: { seeded: true },
        })),
      );
    })().catch((error) => {
      seeding = null;
      console.error("[seed-landing-assets]", error);
      throw error;
    });
  }
  await seeding;
}

export async function listLandingAssets() {
  await ensureLandingAssets();
  return db.select().from(landingAssets);
}

export async function getLandingAssetMap(): Promise<LandingAssetMap> {
  try {
    const rows = await listLandingAssets();
    const map: LandingAssetMap = {};
    for (const row of rows) {
      map[row.slot as LandingAssetSlot] = publicLandingAssetUrl(
        row.imageUrl,
        row.defaultPath,
      );
    }
    // Fill any gaps with defaults
    for (const def of LANDING_ASSET_SLOTS) {
      if (!map[def.slot]) map[def.slot] = def.defaultPath;
    }
    return map;
  } catch (error) {
    console.error("[landing-asset-map]", error);
    const map: LandingAssetMap = {};
    for (const def of LANDING_ASSET_SLOTS) {
      map[def.slot] = def.defaultPath;
    }
    return map;
  }
}

export async function getLandingAssetBySlot(slot: LandingAssetSlot) {
  await ensureLandingAssets();
  const [row] = await db
    .select()
    .from(landingAssets)
    .where(eq(landingAssets.slot, slot))
    .limit(1);
  return row ?? null;
}
