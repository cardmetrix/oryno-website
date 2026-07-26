-- Idempotent: columns/index were already created by 0008_paystack_payout_banks
-- (and/or ensure-schema). Keep this migration so Drizzle's journal stays aligned.

ALTER TABLE "user_bank_accounts" ADD COLUMN IF NOT EXISTS "bank_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD COLUMN IF NOT EXISTS "paystack_recipient_code" varchar(80);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_bank_accounts_recipient_idx" ON "user_bank_accounts" USING btree ("paystack_recipient_code");
