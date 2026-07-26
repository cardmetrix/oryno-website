ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "card_number" varchar(16);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_card_number_uidx" ON "wallets" USING btree ("card_number");
