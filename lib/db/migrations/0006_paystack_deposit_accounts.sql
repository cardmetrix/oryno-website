CREATE TABLE IF NOT EXISTS "user_deposit_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE,
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
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_deposit_accounts" ADD CONSTRAINT "user_deposit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_deposit_accounts_number_uidx" ON "user_deposit_accounts" USING btree ("account_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_deposit_accounts_customer_idx" ON "user_deposit_accounts" USING btree ("paystack_customer_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_fundings_external_ref_uidx" ON "wallet_fundings" USING btree ("external_ref") WHERE "external_ref" IS NOT NULL;
