-- Betting wallet funding: category + orders table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'transaction_category'
      AND e.enumlabel = 'betting'
  ) THEN
    ALTER TYPE "public"."transaction_category" ADD VALUE 'betting';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "betting_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "provider_slug" varchar(80) NOT NULL,
  "provider_name" varchar(120) NOT NULL,
  "customer_ref" varchar(80) NOT NULL,
  "customer_name" varchar(160),
  "amount" numeric(18, 2) NOT NULL,
  "status" "order_status" DEFAULT 'pending' NOT NULL,
  "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE set null,
  "provider_ref" varchar(120),
  "failure_reason" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "betting_orders_user_idx"
  ON "betting_orders" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "betting_orders_status_idx"
  ON "betting_orders" USING btree ("status");
