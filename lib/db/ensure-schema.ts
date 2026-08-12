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
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_deposit_accounts" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
          "provider" varchar(40) DEFAULT 'paystack' NOT NULL,
          "currency" varchar(3) DEFAULT 'NGN' NOT NULL,
          "account_number" varchar(32) NOT NULL,
          "account_name" varchar(160) NOT NULL,
          "bank_name" varchar(120) NOT NULL,
          "bank_slug" varchar(80),
          "paystack_customer_code" varchar(80),
          "paystack_account_id" varchar(80),
          "status" varchar(32) DEFAULT 'active' NOT NULL,
          "metadata" jsonb,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "user_deposit_accounts_number_uidx"
        ON "user_deposit_accounts" USING btree ("account_number")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_deposit_accounts_customer_idx"
        ON "user_deposit_accounts" USING btree ("paystack_customer_code")
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "wallet_fundings_external_ref_uidx"
        ON "wallet_fundings" USING btree ("external_ref")
        WHERE "external_ref" IS NOT NULL
      `);
      await db.execute(sql`
        ALTER TABLE "user_bank_accounts"
        ADD COLUMN IF NOT EXISTS "bank_code" varchar(20)
      `);
      await db.execute(sql`
        ALTER TABLE "user_bank_accounts"
        ADD COLUMN IF NOT EXISTS "paystack_recipient_code" varchar(80)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_bank_accounts_recipient_idx"
        ON "user_bank_accounts" USING btree ("paystack_recipient_code")
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_provider_ref_uidx"
        ON "withdrawals" USING btree ("provider_ref")
        WHERE "provider_ref" IS NOT NULL
      `);
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE "public"."ad_status" AS ENUM('draft', 'live', 'paused', 'archived');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
      `);
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE "public"."ad_placement" AS ENUM('home_carousel', 'promo_banner');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ads" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "title" varchar(120) NOT NULL,
          "subtitle" varchar(200),
          "image_url" text NOT NULL,
          "href" varchar(255) NOT NULL,
          "badge" varchar(40),
          "overlay" varchar(200),
          "overlay_colors" jsonb,
          "placement" "ad_placement" DEFAULT 'home_carousel' NOT NULL,
          "status" "ad_status" DEFAULT 'draft' NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "starts_at" timestamp with time zone,
          "ends_at" timestamp with time zone,
          "created_by_admin_id" uuid,
          "metadata" jsonb,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ads_status_placement_idx"
        ON "ads" USING btree ("status","placement")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ads_sort_idx"
        ON "ads" USING btree ("sort_order")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "ads_ends_at_idx"
        ON "ads" USING btree ("ends_at")
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "onboarding_slides" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "title" varchar(120) NOT NULL,
          "subtitle" varchar(280) NOT NULL,
          "image_url" text NOT NULL,
          "accent" varchar(32),
          "status" "ad_status" DEFAULT 'draft' NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "created_by_admin_id" uuid,
          "metadata" jsonb,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "onboarding_slides_status_idx"
        ON "onboarding_slides" USING btree ("status")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "onboarding_slides_sort_idx"
        ON "onboarding_slides" USING btree ("sort_order")
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_push_tokens" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
          "token" text NOT NULL,
          "platform" varchar(20) DEFAULT 'unknown' NOT NULL,
          "device_id" varchar(120),
          "app_version" varchar(40),
          "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "user_push_tokens_token_uidx"
        ON "user_push_tokens" USING btree ("token")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_push_tokens_user_idx"
        ON "user_push_tokens" USING btree ("user_id")
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "service_price_overrides" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "provider" varchar(40) NOT NULL,
          "service_key" varchar(160) NOT NULL,
          "label" varchar(200),
          "mode" varchar(20) DEFAULT 'percent' NOT NULL,
          "value" numeric(18, 6) NOT NULL,
          "active" boolean DEFAULT true NOT NULL,
          "metadata" jsonb,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "service_price_overrides_provider_key_uidx"
        ON "service_price_overrides" USING btree ("provider","service_key")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "service_price_overrides_provider_idx"
        ON "service_price_overrides" USING btree ("provider")
      `);
      await db.execute(sql`
        ALTER TABLE "user_security"
        ADD COLUMN IF NOT EXISTS "pin_encrypted" text
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "usd_virtual_card_waitlist" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
          "email" varchar(255) NOT NULL,
          "country_code" varchar(2) REFERENCES "countries"("code"),
          "provider" varchar(40) DEFAULT 'maplerad' NOT NULL,
          "notified_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "usd_virtual_card_waitlist_email_uidx"
        ON "usd_virtual_card_waitlist" USING btree ("email")
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "landing_assets" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "slot" varchar(64) NOT NULL,
          "label" varchar(120) NOT NULL,
          "description" varchar(280),
          "image_url" text NOT NULL,
          "default_path" varchar(255) NOT NULL,
          "group" varchar(40) DEFAULT 'landing' NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "updated_by_admin_id" uuid,
          "metadata" jsonb,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "landing_assets_slot_uidx"
        ON "landing_assets" USING btree ("slot")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "landing_assets_group_idx"
        ON "landing_assets" USING btree ("group")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "landing_assets_sort_idx"
        ON "landing_assets" USING btree ("sort_order")
      `);
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE "testimonial_status" AS ENUM('pending', 'approved', 'rejected');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "testimonial_reviews" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "author_name" varchar(120) NOT NULL,
          "author_role" varchar(120),
          "rating" integer DEFAULT 5 NOT NULL,
          "body" text NOT NULL,
          "status" "testimonial_status" DEFAULT 'pending' NOT NULL,
          "featured" boolean DEFAULT false NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "user_id" uuid,
          "approved_by_admin_id" uuid,
          "approved_at" timestamp with time zone,
          "metadata" jsonb,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "testimonial_reviews_status_idx"
        ON "testimonial_reviews" USING btree ("status")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "testimonial_reviews_sort_idx"
        ON "testimonial_reviews" USING btree ("sort_order")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "testimonial_reviews_featured_idx"
        ON "testimonial_reviews" USING btree ("featured")
      `);
    })().catch((error) => {
      ready = null;
      console.error("[ensure-wallet-schema]", error);
      // Don't block reads if we lack DDL privileges — queries may still work.
    });
  }
  await ready;
}
