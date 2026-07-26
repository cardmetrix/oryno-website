ALTER TABLE "user_bank_accounts" ADD COLUMN IF NOT EXISTS "bank_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD COLUMN IF NOT EXISTS "paystack_recipient_code" varchar(80);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_bank_accounts_recipient_idx" ON "user_bank_accounts" USING btree ("paystack_recipient_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_provider_ref_uidx" ON "withdrawals" USING btree ("provider_ref") WHERE "provider_ref" IS NOT NULL;
