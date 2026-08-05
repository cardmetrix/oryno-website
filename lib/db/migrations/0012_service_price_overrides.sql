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
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "service_price_overrides_provider_key_uidx" ON "service_price_overrides" USING btree ("provider","service_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_price_overrides_provider_idx" ON "service_price_overrides" USING btree ("provider");
