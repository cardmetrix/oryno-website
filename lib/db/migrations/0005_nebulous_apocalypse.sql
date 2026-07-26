ALTER TABLE "wallets" ADD COLUMN "card_number" varchar(16);--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_card_number_uidx" ON "wallets" USING btree ("card_number");