-- Idempotent: user_deposit_accounts was already created by 0006_paystack_deposit_accounts.
-- This migration only ensures remaining constraints/indexes exist.

DO $$ BEGIN
 ALTER TABLE "user_deposit_accounts" ADD CONSTRAINT "user_deposit_accounts_user_id_unique" UNIQUE("user_id");
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN duplicate_table THEN null;
END $$;
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
