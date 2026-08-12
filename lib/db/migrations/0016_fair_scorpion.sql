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
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "landing_assets_slot_uidx" ON "landing_assets" USING btree ("slot");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_assets_group_idx" ON "landing_assets" USING btree ("group");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_assets_sort_idx" ON "landing_assets" USING btree ("sort_order");
