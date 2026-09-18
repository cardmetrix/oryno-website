CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");
--> statement-breakpoint
-- Existing staff in `admins` become app-level admins
UPDATE "users"
SET "role" = 'admin', "updated_at" = now()
WHERE lower("email") IN (
  SELECT lower("email") FROM "admins" WHERE "active" = true
);
