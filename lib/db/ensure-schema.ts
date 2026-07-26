import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

/**
 * Self-heal schema drift on serverless/prod when migrations lag behind code.
 * Safe to call on every request — runs once per process.
 */
export async function ensureWalletSchema() {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        ALTER TABLE "wallets"
        ADD COLUMN IF NOT EXISTS "card_number" varchar(16)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "wallets_card_number_uidx"
        ON "wallets" USING btree ("card_number")
      `);
      await db.execute(sql`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "avatar_url" text
      `);
      await db.execute(sql`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "username" varchar(64)
      `);
    })().catch((error) => {
      ready = null;
      console.error("[ensure-wallet-schema]", error);
      // Don't block reads if we lack DDL privileges — queries may still work.
    });
  }
  await ready;
}
