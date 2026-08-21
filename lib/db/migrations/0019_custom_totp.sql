-- App-owned Google Authenticator TOTP (does not use Clerk Pro MFA).
ALTER TABLE "user_security"
  ADD COLUMN IF NOT EXISTS "totp_secret_encrypted" text;
ALTER TABLE "user_security"
  ADD COLUMN IF NOT EXISTS "totp_pending_secret_encrypted" text;
ALTER TABLE "user_security"
  ADD COLUMN IF NOT EXISTS "failed_totp_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user_security"
  ADD COLUMN IF NOT EXISTS "totp_locked_until" timestamp with time zone;
