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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_slides_status_idx" ON "onboarding_slides" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_slides_sort_idx" ON "onboarding_slides" USING btree ("sort_order");
