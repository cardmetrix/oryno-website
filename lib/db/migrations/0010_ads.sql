CREATE TYPE "public"."ad_status" AS ENUM('draft', 'live', 'paused', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."ad_placement" AS ENUM('home_carousel', 'promo_banner');
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_status_placement_idx" ON "ads" USING btree ("status","placement");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_sort_idx" ON "ads" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_ends_at_idx" ON "ads" USING btree ("ends_at");
