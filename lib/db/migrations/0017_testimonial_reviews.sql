DO $$ BEGIN
 CREATE TYPE "public"."testimonial_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
CREATE INDEX IF NOT EXISTS "testimonial_reviews_status_idx" ON "testimonial_reviews" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "testimonial_reviews_sort_idx" ON "testimonial_reviews" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "testimonial_reviews_featured_idx" ON "testimonial_reviews" USING btree ("featured");
