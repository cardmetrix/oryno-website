-- Idempotent: objects may already exist from 0017–0020_betting_funding or ensure-schema.

DO $$ BEGIN
  CREATE TYPE "public"."testimonial_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ad_placement'
      AND e.enumlabel = 'services_carousel'
  ) THEN
    ALTER TYPE "public"."ad_placement" ADD VALUE 'services_carousel';
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'transaction_category'
      AND e.enumlabel = 'betting'
  ) THEN
    ALTER TYPE "public"."transaction_category" ADD VALUE 'betting';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "betting_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider_slug" varchar(80) NOT NULL,
  "provider_name" varchar(120) NOT NULL,
  "customer_ref" varchar(80) NOT NULL,
  "customer_name" varchar(160),
  "amount" numeric(18, 2) NOT NULL,
  "status" "order_status" DEFAULT 'pending' NOT NULL,
  "transaction_id" uuid,
  "provider_ref" varchar(120),
  "failure_reason" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
ALTER TABLE "user_deposit_accounts" ALTER COLUMN "provider" SET DEFAULT 'flutterwave';
--> statement-breakpoint
ALTER TABLE "user_security" ADD COLUMN IF NOT EXISTS "totp_secret_encrypted" text;
--> statement-breakpoint
ALTER TABLE "user_security" ADD COLUMN IF NOT EXISTS "totp_pending_secret_encrypted" text;
--> statement-breakpoint
ALTER TABLE "user_security" ADD COLUMN IF NOT EXISTS "failed_totp_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_security" ADD COLUMN IF NOT EXISTS "totp_locked_until" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "betting_orders"
    ADD CONSTRAINT "betting_orders_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "betting_orders"
    ADD CONSTRAINT "betting_orders_transaction_id_transactions_id_fk"
    FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "betting_orders_user_idx" ON "betting_orders" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "betting_orders_status_idx" ON "betting_orders" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "testimonial_reviews_status_idx" ON "testimonial_reviews" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "testimonial_reviews_sort_idx" ON "testimonial_reviews" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "testimonial_reviews_featured_idx" ON "testimonial_reviews" USING btree ("featured");
