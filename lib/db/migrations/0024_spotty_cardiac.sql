DO $$ BEGIN
  CREATE TYPE "public"."usd_virtual_card_order_status" AS ENUM('pending_payment', 'paid_pending_review', 'approved', 'rejected', 'issued');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."usd_virtual_card_status" AS ENUM('active', 'frozen', 'terminated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usd_virtual_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"brand" varchar(20) DEFAULT 'visa' NOT NULL,
	"label" varchar(80) DEFAULT 'ORYNO USD' NOT NULL,
	"last4" varchar(4) NOT NULL,
	"exp_month" integer NOT NULL,
	"exp_year" integer NOT NULL,
	"pan_cipher" text NOT NULL,
	"cvv_cipher" text NOT NULL,
	"status" "usd_virtual_card_status" DEFAULT 'active' NOT NULL,
	"provider" varchar(40) DEFAULT 'oryno' NOT NULL,
	"external_ref" varchar(120),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usd_virtual_card_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fee_usd" numeric(18, 2) NOT NULL,
	"local_amount" numeric(18, 2) NOT NULL,
	"local_currency" varchar(3) NOT NULL,
	"status" "usd_virtual_card_order_status" DEFAULT 'pending_payment' NOT NULL,
	"payment_ref" varchar(120),
	"card_id" uuid,
	"reviewed_by" varchar(80),
	"review_note" text,
	"paid_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "usd_virtual_card_orders" ADD CONSTRAINT "usd_virtual_card_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "usd_virtual_card_orders" ADD CONSTRAINT "usd_virtual_card_orders_card_id_usd_virtual_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."usd_virtual_cards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "usd_virtual_cards" ADD CONSTRAINT "usd_virtual_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "usd_virtual_cards" ADD CONSTRAINT "usd_virtual_cards_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usd_virtual_card_orders_user_idx" ON "usd_virtual_card_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usd_virtual_card_orders_status_idx" ON "usd_virtual_card_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usd_virtual_card_orders_payment_ref_uidx" ON "usd_virtual_card_orders" USING btree ("payment_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usd_virtual_cards_user_idx" ON "usd_virtual_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usd_virtual_cards_status_idx" ON "usd_virtual_cards" USING btree ("status");
