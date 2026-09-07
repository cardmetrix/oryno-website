CREATE TABLE IF NOT EXISTS "company_balances" (
	"currency" varchar(3) PRIMARY KEY NOT NULL,
	"available" numeric(18, 2) DEFAULT '0' NOT NULL,
	"reserved" numeric(18, 2) DEFAULT '0' NOT NULL,
	"lifetime_recognized" numeric(18, 2) DEFAULT '0' NOT NULL,
	"lifetime_withdrawn" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_revenue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(40) NOT NULL,
	"status" varchar(20) DEFAULT 'recognized' NOT NULL,
	"transaction_id" uuid,
	"user_id" uuid,
	"currency" varchar(3) NOT NULL,
	"gross_in" numeric(18, 2) DEFAULT '0' NOT NULL,
	"gross_out" numeric(18, 2) DEFAULT '0' NOT NULL,
	"markup_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"charge_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"fx_spread_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"profit_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"profit_ngn" numeric(18, 2) DEFAULT '0' NOT NULL,
	"description" varchar(255),
	"metadata" jsonb,
	"recognized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_revenue_entries_tx_uidx" ON "company_revenue_entries" USING btree ("transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_revenue_entries_source_idx" ON "company_revenue_entries" USING btree ("source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_revenue_entries_status_idx" ON "company_revenue_entries" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_revenue_entries_created_idx" ON "company_revenue_entries" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"destination_label" varchar(160),
	"bank_name" varchar(120),
	"account_name" varchar(160),
	"account_number" varchar(32),
	"bank_code" varchar(20),
	"provider_ref" varchar(120),
	"admin_id" uuid,
	"notes" text,
	"processed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_payouts_status_idx" ON "company_payouts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_payouts_created_idx" ON "company_payouts" USING btree ("created_at");
--> statement-breakpoint
INSERT INTO "company_balances" ("currency", "available", "reserved", "lifetime_recognized", "lifetime_withdrawn")
VALUES ('NGN', '0', '0', '0', '0'), ('USD', '0', '0', '0', '0')
ON CONFLICT ("currency") DO NOTHING;
