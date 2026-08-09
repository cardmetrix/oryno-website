ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_level" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD COLUMN IF NOT EXISTS "target_level" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- Existing verified users keep access as Level 1 (government ID).
UPDATE "users" SET "kyc_level" = 1 WHERE "kyc_status" = 'verified' AND "kyc_level" = 0;
