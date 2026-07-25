CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin', 'support', 'finance', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."bill_category" AS ENUM('electricity', 'tv', 'utility', 'other');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."country_status" AS ENUM('live', 'beta', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."data_plan_category" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."funding_method" AS ENUM('card', 'bank_transfer', 'ussd', 'mobile_money');--> statement-breakpoint
CREATE TYPE "public"."gateway_mode" AS ENUM('live', 'test');--> statement-breakpoint
CREATE TYPE "public"."gateway_status" AS ENUM('connected', 'available', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."gift_card_brand_status" AS ENUM('live', 'paused', 'soon', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."gift_card_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."otp_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('register', 'login', 'reset_password', 'two_factor', 'verify_phone', 'verify_email');--> statement-breakpoint
CREATE TYPE "public"."provider_status" AS ENUM('active', 'maintenance', 'pending', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."support_sender" AS ENUM('user', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."transaction_category" AS ENUM('fund', 'withdraw', 'transfer', 'airtime', 'data', 'bill', 'virtual_number', 'social', 'gift_card', 'cashback', 'referral', 'refund', 'fee', 'other');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."virtual_number_type" AS ENUM('buy', 'rent');--> statement-breakpoint
CREATE TYPE "public"."wallet_status" AS ENUM('healthy', 'frozen', 'closed');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending_verification', 'processing', 'sent_to_provider', 'completed', 'failed', 'reversed');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80),
	"entity_id" varchar(80),
	"meta" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"passcode_hash" text,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "airtime_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"network_id" uuid NOT NULL,
	"phone" varchar(32) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"cashback_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"save_beneficiary" boolean DEFAULT false NOT NULL,
	"transaction_id" uuid,
	"provider_ref" varchar(120),
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(32),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beneficiaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" varchar(32) NOT NULL,
	"network_id" uuid,
	"label" varchar(80),
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"customer_ref" varchar(80) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"token_or_receipt" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid,
	"provider_ref" varchar(120),
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"category" "bill_category" NOT NULL,
	"description" text,
	"accent" varchar(16),
	"status" "provider_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" varchar(2) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"currency_symbol" varchar(8) NOT NULL,
	"flag_emoji" varchar(16),
	"status" "country_status" DEFAULT 'beta' NOT NULL,
	"gift_cards_enabled" boolean DEFAULT false NOT NULL,
	"enabled_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payout_config" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"gateway_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"network_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"phone" varchar(32) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid,
	"provider_ref" varchar(120),
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"size" varchar(40) NOT NULL,
	"validity" varchar(40) NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"category" "data_plan_category" NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"external_plan_code" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"category" varchar(80) NOT NULL,
	"color" varchar(16),
	"status" "gift_card_brand_status" DEFAULT 'soon' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_card_brands_name_unique" UNIQUE("name"),
	CONSTRAINT "gift_card_brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gift_card_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"user_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"side" "gift_card_side" NOT NULL,
	"amount_usd" numeric(18, 2) NOT NULL,
	"local_amount" numeric(18, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"card_image_url" text,
	"card_code_encrypted" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid,
	"reviewed_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_card_orders_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "gift_card_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"buy_rate" numeric(18, 4) NOT NULL,
	"sell_rate" numeric(18, 4) NOT NULL,
	"status" "gift_card_brand_status" DEFAULT 'soon' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(255) NOT NULL,
	"country_code" varchar(2),
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"step" integer DEFAULT 1 NOT NULL,
	"id_type" varchar(64),
	"id_number" varchar(64),
	"id_front_url" text,
	"id_back_url" text,
	"selfie_url" text,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by_admin_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"audience" varchar(120) NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(40) DEFAULT 'system' NOT NULL,
	"unread" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"target" varchar(255) NOT NULL,
	"channel" "otp_channel" NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"status" "gateway_status" DEFAULT 'available' NOT NULL,
	"mode" "gateway_mode" DEFAULT 'test' NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_gateways_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"status" "referral_status" DEFAULT 'active' NOT NULL,
	"joins_count" integer DEFAULT 0 NOT NULL,
	"earnings" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"reward_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_events_referred_user_id_unique" UNIQUE("referred_user_id")
);
--> statement-breakpoint
CREATE TABLE "social_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"profile_url" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"delivery_eta" varchar(40),
	"transaction_id" uuid,
	"provider_ref" varchar(120),
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"platform" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"metric" varchar(40) NOT NULL,
	"quantity" varchar(40) NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"delivery" varchar(40) NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender" "support_sender" NOT NULL,
	"sender_user_id" uuid,
	"sender_admin_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"user_id" uuid,
	"topic" varchar(80) NOT NULL,
	"email" varchar(255) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "telecom_networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"color" varchar(16),
	"soft_color" varchar(64),
	"status" "provider_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"category" "transaction_category" NOT NULL,
	"title" varchar(160) NOT NULL,
	"subtitle" varchar(255),
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"balance_after" numeric(18, 2),
	"related_order_id" uuid,
	"related_order_type" varchar(64),
	"external_ref" varchar(120),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank_id" uuid,
	"bank_name" varchar(120) NOT NULL,
	"account_name" varchar(160) NOT NULL,
	"account_number" varchar(32) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_security" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pin_hash" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"biometric_enabled" boolean DEFAULT false NOT NULL,
	"failed_pin_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_info" varchar(255),
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_virtual_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"type" "virtual_number_type" NOT NULL,
	"status" "order_status" DEFAULT 'completed' NOT NULL,
	"expires_at" timestamp with time zone,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(255),
	"full_name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(32),
	"password_hash" text,
	"country_code" varchar(2),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'unverified' NOT NULL,
	"language" varchar(16) DEFAULT 'en' NOT NULL,
	"theme" "theme_preference" DEFAULT 'light' NOT NULL,
	"referral_code_id" uuid,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "virtual_number_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"country_name" varchar(120) NOT NULL,
	"flag_emoji" varchar(16),
	"type" "virtual_number_type" NOT NULL,
	"category" varchar(80) NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"duration" varchar(40) NOT NULL,
	"sms_capable" boolean DEFAULT true NOT NULL,
	"stock_buy" integer DEFAULT 0 NOT NULL,
	"stock_rent" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_number_sms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_virtual_number_id" uuid NOT NULL,
	"from_number" varchar(32),
	"body" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_fundings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"gateway_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"method" "funding_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"external_ref" varchar(120),
	"transaction_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"status" "wallet_status" DEFAULT 'healthy' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"daily_limit" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"fee" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending_verification' NOT NULL,
	"provider_ref" varchar(120),
	"failure_reason" text,
	"transaction_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airtime_orders" ADD CONSTRAINT "airtime_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airtime_orders" ADD CONSTRAINT "airtime_orders_network_id_telecom_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."telecom_networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airtime_orders" ADD CONSTRAINT "airtime_orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banks" ADD CONSTRAINT "banks_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_network_id_telecom_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."telecom_networks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_provider_id_bill_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."bill_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_providers" ADD CONSTRAINT "bill_providers_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_gateways" ADD CONSTRAINT "country_gateways_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_gateways" ADD CONSTRAINT "country_gateways_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_orders" ADD CONSTRAINT "data_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_orders" ADD CONSTRAINT "data_orders_network_id_telecom_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."telecom_networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_orders" ADD CONSTRAINT "data_orders_plan_id_data_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."data_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_orders" ADD CONSTRAINT "data_orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_plans" ADD CONSTRAINT "data_plans_network_id_telecom_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."telecom_networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_orders" ADD CONSTRAINT "gift_card_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_orders" ADD CONSTRAINT "gift_card_orders_brand_id_gift_card_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."gift_card_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_orders" ADD CONSTRAINT "gift_card_orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_rates" ADD CONSTRAINT "gift_card_rates_brand_id_gift_card_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."gift_card_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_rates" ADD CONSTRAINT "gift_card_rates_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_waitlist" ADD CONSTRAINT "gift_card_waitlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_waitlist" ADD CONSTRAINT "gift_card_waitlist_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_code_id_referral_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."referral_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_orders" ADD CONSTRAINT "social_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_orders" ADD CONSTRAINT "social_orders_package_id_social_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."social_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_orders" ADD CONSTRAINT "social_orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_packages" ADD CONSTRAINT "social_packages_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telecom_networks" ADD CONSTRAINT "telecom_networks_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_security" ADD CONSTRAINT "user_security_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_virtual_numbers" ADD CONSTRAINT "user_virtual_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_virtual_numbers" ADD CONSTRAINT "user_virtual_numbers_offer_id_virtual_number_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."virtual_number_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_virtual_numbers" ADD CONSTRAINT "user_virtual_numbers_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_number_sms" ADD CONSTRAINT "virtual_number_sms_user_virtual_number_id_user_virtual_numbers_id_fk" FOREIGN KEY ("user_virtual_number_id") REFERENCES "public"."user_virtual_numbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_fundings" ADD CONSTRAINT "wallet_fundings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_fundings" ADD CONSTRAINT "wallet_fundings_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_fundings" ADD CONSTRAINT "wallet_fundings_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_fundings" ADD CONSTRAINT "wallet_fundings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_bank_account_id_user_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."user_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_admin_idx" ON "admin_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "airtime_orders_user_idx" ON "airtime_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "airtime_orders_status_idx" ON "airtime_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "banks_country_idx" ON "banks" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "beneficiaries_user_phone_uidx" ON "beneficiaries" USING btree ("user_id","phone");--> statement-breakpoint
CREATE INDEX "bill_payments_user_idx" ON "bill_payments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bill_providers_country_slug_uidx" ON "bill_providers" USING btree ("country_code","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "country_gateways_country_gateway_uidx" ON "country_gateways" USING btree ("country_code","gateway_id");--> statement-breakpoint
CREATE INDEX "data_orders_user_idx" ON "data_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_orders_status_idx" ON "data_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_plans_network_idx" ON "data_plans" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "gift_card_orders_user_idx" ON "gift_card_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gift_card_orders_status_idx" ON "gift_card_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_card_rates_brand_country_uidx" ON "gift_card_rates" USING btree ("brand_id","country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_card_waitlist_email_uidx" ON "gift_card_waitlist" USING btree ("email");--> statement-breakpoint
CREATE INDEX "kyc_submissions_user_idx" ON "kyc_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","unread");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "otp_codes_target_purpose_idx" ON "otp_codes" USING btree ("target","purpose");--> statement-breakpoint
CREATE INDEX "otp_codes_user_idx" ON "otp_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_codes_code_idx" ON "referral_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referral_events_referrer_idx" ON "referral_events" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "social_orders_user_idx" ON "social_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "social_packages_country_platform_idx" ON "social_packages" USING btree ("country_code","platform");--> statement-breakpoint
CREATE INDEX "support_messages_ticket_idx" ON "support_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "telecom_networks_country_slug_uidx" ON "telecom_networks" USING btree ("country_code","slug");--> statement-breakpoint
CREATE INDEX "transactions_user_created_idx" ON "transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_wallet_idx" ON "transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_bank_accounts_user_idx" ON "user_bank_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_bank_accounts_user_number_uidx" ON "user_bank_accounts" USING btree ("user_id","account_number");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_virtual_numbers_user_idx" ON "user_virtual_numbers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_country_idx" ON "users" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "virtual_number_offers_country_type_idx" ON "virtual_number_offers" USING btree ("country_code","type");--> statement-breakpoint
CREATE INDEX "virtual_number_sms_number_idx" ON "virtual_number_sms" USING btree ("user_virtual_number_id");--> statement-breakpoint
CREATE INDEX "wallet_fundings_user_idx" ON "wallet_fundings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_currency_uidx" ON "wallets" USING btree ("user_id","currency");--> statement-breakpoint
CREATE INDEX "wallets_status_idx" ON "wallets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawals_user_idx" ON "withdrawals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status");