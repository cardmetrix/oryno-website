import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** Shared timestamp columns */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "deleted",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const otpPurposeEnum = pgEnum("otp_purpose", [
  "register",
  "login",
  "reset_password",
  "two_factor",
  "verify_phone",
  "verify_email",
]);

export const otpChannelEnum = pgEnum("otp_channel", ["email", "sms"]);

export const themeEnum = pgEnum("theme_preference", ["light", "dark", "system"]);

export const countryStatusEnum = pgEnum("country_status", [
  "live",
  "beta",
  "disabled",
]);

export const walletStatusEnum = pgEnum("wallet_status", [
  "healthy",
  "frozen",
  "closed",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "credit",
  "debit",
]);

export const transactionCategoryEnum = pgEnum("transaction_category", [
  "fund",
  "withdraw",
  "transfer",
  "airtime",
  "data",
  "bill",
  "virtual_number",
  "social",
  "gift_card",
  "cashback",
  "referral",
  "refund",
  "fee",
  "other",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "reversed",
  "cancelled",
]);

export const fundingMethodEnum = pgEnum("funding_method", [
  "card",
  "bank_transfer",
  "ussd",
  "mobile_money",
]);

export const providerStatusEnum = pgEnum("provider_status", [
  "active",
  "maintenance",
  "pending",
  "disabled",
]);

export const billCategoryEnum = pgEnum("bill_category", [
  "electricity",
  "tv",
  "utility",
  "other",
]);

export const dataPlanCategoryEnum = pgEnum("data_plan_category", [
  "daily",
  "weekly",
  "monthly",
]);

export const virtualNumberTypeEnum = pgEnum("virtual_number_type", [
  "buy",
  "rent",
]);

export const giftCardSideEnum = pgEnum("gift_card_side", ["buy", "sell"]);

export const giftCardBrandStatusEnum = pgEnum("gift_card_brand_status", [
  "live",
  "paused",
  "soon",
  "disabled",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "refunded",
]);

export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "pending_verification",
  "processing",
  "sent_to_provider",
  "completed",
  "failed",
  "reversed",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const supportSenderEnum = pgEnum("support_sender", [
  "user",
  "agent",
  "system",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "sent",
  "cancelled",
]);

export const gatewayStatusEnum = pgEnum("gateway_status", [
  "connected",
  "available",
  "disabled",
]);

export const gatewayModeEnum = pgEnum("gateway_mode", ["live", "test"]);

export const adminRoleEnum = pgEnum("admin_role", [
  "super_admin",
  "admin",
  "support",
  "finance",
  "viewer",
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "active",
  "paused",
  "disabled",
]);

// ─── 1. Country configuration (no hardcoded country logic) ───────────────────

export const countries = pgTable("countries", {
  code: varchar("code", { length: 2 }).primaryKey(), // ISO-3166-1 alpha-2
  name: varchar("name", { length: 120 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  currencySymbol: varchar("currency_symbol", { length: 8 }).notNull(),
  flagEmoji: varchar("flag_emoji", { length: 16 }),
  status: countryStatusEnum("status").notNull().default("beta"),
  giftCardsEnabled: boolean("gift_cards_enabled").notNull().default(false),
  enabledServices: jsonb("enabled_services")
    .$type<string[]>()
    .notNull()
    .default([]),
  payoutConfig: jsonb("payout_config").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ...timestamps,
});

export const paymentGateways = pgTable("payment_gateways", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  status: gatewayStatusEnum("status").notNull().default("available"),
  mode: gatewayModeEnum("mode").notNull().default("test"),
  config: jsonb("config").$type<Record<string, unknown>>(),
  ...timestamps,
});

export const countryGateways = pgTable(
  "country_gateways",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references(() => paymentGateways.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("country_gateways_country_gateway_uidx").on(
      t.countryCode,
      t.gatewayId,
    ),
  ],
);

export const banks = pgTable(
  "banks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 32 }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("banks_country_idx").on(t.countryCode)],
);

// ─── 2. Users & auth ─────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkId: varchar("clerk_id", { length: 255 }).unique(),
    username: varchar("username", { length: 64 }).unique(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 32 }),
    avatarUrl: text("avatar_url"),
    passwordHash: text("password_hash"),
    countryCode: varchar("country_code", { length: 2 }).references(
      () => countries.code,
    ),
    status: userStatusEnum("status").notNull().default("active"),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("unverified"),
    language: varchar("language", { length: 16 }).notNull().default("en"),
    theme: themeEnum("theme").notNull().default("light"),
    referralCodeId: uuid("referral_code_id"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("users_country_idx").on(t.countryCode),
    index("users_status_idx").on(t.status),
  ],
);

export const userSecurity = pgTable("user_security", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  pinHash: text("pin_hash"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  biometricEnabled: boolean("biometric_enabled").notNull().default(false),
  failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  ...timestamps,
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    target: varchar("target", { length: 255 }).notNull(),
    channel: otpChannelEnum("channel").notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("otp_codes_target_purpose_idx").on(t.target, t.purpose),
    index("otp_codes_user_idx").on(t.userId),
  ],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceInfo: varchar("device_info", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("user_sessions_user_idx").on(t.userId)],
);

export const kycSubmissions = pgTable(
  "kyc_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    step: integer("step").notNull().default(1),
    idType: varchar("id_type", { length: 64 }),
    idNumber: varchar("id_number", { length: 64 }),
    idFrontUrl: text("id_front_url"),
    idBackUrl: text("id_back_url"),
    selfieUrl: text("selfie_url"),
    status: kycStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    reviewedByAdminId: uuid("reviewed_by_admin_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("kyc_submissions_user_idx").on(t.userId)],
);

export const userBankAccounts = pgTable(
  "user_bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankId: uuid("bank_id").references(() => banks.id, {
      onDelete: "set null",
    }),
    bankName: varchar("bank_name", { length: 120 }).notNull(),
    accountName: varchar("account_name", { length: 160 }).notNull(),
    accountNumber: varchar("account_number", { length: 32 }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("user_bank_accounts_user_idx").on(t.userId),
    uniqueIndex("user_bank_accounts_user_number_uidx").on(
      t.userId,
      t.accountNumber,
    ),
  ],
);

/** Paystack Dedicated Virtual Account for wallet deposits */
export const userDepositAccounts = pgTable(
  "user_deposit_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    provider: varchar("provider", { length: 40 }).notNull().default("paystack"),
    currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
    accountNumber: varchar("account_number", { length: 32 }).notNull(),
    accountName: varchar("account_name", { length: 160 }).notNull(),
    bankName: varchar("bank_name", { length: 120 }).notNull(),
    bankSlug: varchar("bank_slug", { length: 80 }),
    paystackCustomerCode: varchar("paystack_customer_code", { length: 80 }),
    paystackAccountId: varchar("paystack_account_id", { length: 80 }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("user_deposit_accounts_number_uidx").on(t.accountNumber),
    index("user_deposit_accounts_customer_idx").on(t.paystackCustomerCode),
  ],
);

// ─── 3. Wallets & ledger ─────────────────────────────────────────────────────

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    balance: numeric("balance", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    status: walletStatusEnum("status").notNull().default("healthy"),
    isPrimary: boolean("is_primary").notNull().default(false),
    /** Unique virtual debit card number issued per wallet */
    cardNumber: varchar("card_number", { length: 16 }),
    dailyLimit: numeric("daily_limit", { precision: 18, scale: 2 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("wallets_user_currency_uidx").on(t.userId, t.currency),
    uniqueIndex("wallets_card_number_uidx").on(t.cardNumber),
    index("wallets_status_idx").on(t.status),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    category: transactionCategoryEnum("category").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    subtitle: varchar("subtitle", { length: 255 }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    balanceAfter: numeric("balance_after", { precision: 18, scale: 2 }),
    relatedOrderId: uuid("related_order_id"),
    relatedOrderType: varchar("related_order_type", { length: 64 }),
    externalRef: varchar("external_ref", { length: 120 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index("transactions_user_created_idx").on(t.userId, t.createdAt),
    index("transactions_wallet_idx").on(t.walletId),
    index("transactions_status_idx").on(t.status),
    index("transactions_category_idx").on(t.category),
  ],
);

export const walletFundings = pgTable(
  "wallet_fundings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id").references(() => paymentGateways.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    method: fundingMethodEnum("method").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    externalRef: varchar("external_ref", { length: 120 }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index("wallet_fundings_user_idx").on(t.userId),
    uniqueIndex("wallet_fundings_external_ref_uidx").on(t.externalRef),
  ],
);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => userBankAccounts.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    fee: numeric("fee", { precision: 18, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull(),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .references(() => countries.code),
    status: withdrawalStatusEnum("status")
      .notNull()
      .default("pending_verification"),
    providerRef: varchar("provider_ref", { length: 120 }),
    failureReason: text("failure_reason"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("withdrawals_user_idx").on(t.userId),
    index("withdrawals_status_idx").on(t.status),
  ],
);

// ─── 4. Telecom: airtime & data ──────────────────────────────────────────────

export const telecomNetworks = pgTable(
  "telecom_networks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    color: varchar("color", { length: 16 }),
    softColor: varchar("soft_color", { length: 64 }),
    status: providerStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("telecom_networks_country_slug_uidx").on(
      t.countryCode,
      t.slug,
    ),
  ],
);

export const dataPlans = pgTable(
  "data_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    networkId: uuid("network_id")
      .notNull()
      .references(() => telecomNetworks.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    size: varchar("size", { length: 40 }).notNull(),
    validity: varchar("validity", { length: 40 }).notNull(),
    price: numeric("price", { precision: 18, scale: 2 }).notNull(),
    category: dataPlanCategoryEnum("category").notNull(),
    popular: boolean("popular").notNull().default(false),
    active: boolean("active").notNull().default(true),
    externalPlanCode: varchar("external_plan_code", { length: 80 }),
    ...timestamps,
  },
  (t) => [index("data_plans_network_idx").on(t.networkId)],
);

export const beneficiaries = pgTable(
  "beneficiaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 32 }).notNull(),
    networkId: uuid("network_id").references(() => telecomNetworks.id, {
      onDelete: "set null",
    }),
    label: varchar("label", { length: 80 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("beneficiaries_user_phone_uidx").on(t.userId, t.phone),
  ],
);

export const airtimeOrders = pgTable(
  "airtime_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    networkId: uuid("network_id")
      .notNull()
      .references(() => telecomNetworks.id),
    phone: varchar("phone", { length: 32 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    cashbackAmount: numeric("cashback_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    status: orderStatusEnum("status").notNull().default("pending"),
    saveBeneficiary: boolean("save_beneficiary").notNull().default(false),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    providerRef: varchar("provider_ref", { length: 120 }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (t) => [
    index("airtime_orders_user_idx").on(t.userId),
    index("airtime_orders_status_idx").on(t.status),
  ],
);

export const dataOrders = pgTable(
  "data_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    networkId: uuid("network_id")
      .notNull()
      .references(() => telecomNetworks.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => dataPlans.id),
    phone: varchar("phone", { length: 32 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    providerRef: varchar("provider_ref", { length: 120 }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (t) => [
    index("data_orders_user_idx").on(t.userId),
    index("data_orders_status_idx").on(t.status),
  ],
);

// ─── 5. Bill payments ────────────────────────────────────────────────────────

export const billProviders = pgTable(
  "bill_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    category: billCategoryEnum("category").notNull(),
    description: text("description"),
    accent: varchar("accent", { length: 16 }),
    status: providerStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bill_providers_country_slug_uidx").on(t.countryCode, t.slug),
  ],
);

export const billPayments = pgTable(
  "bill_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => billProviders.id),
    customerRef: varchar("customer_ref", { length: 80 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    tokenOrReceipt: text("token_or_receipt"),
    status: orderStatusEnum("status").notNull().default("pending"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    providerRef: varchar("provider_ref", { length: 120 }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (t) => [index("bill_payments_user_idx").on(t.userId)],
);

// ─── 6. Virtual numbers ──────────────────────────────────────────────────────

export const virtualNumberOffers = pgTable(
  "virtual_number_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    countryName: varchar("country_name", { length: 120 }).notNull(),
    flagEmoji: varchar("flag_emoji", { length: 16 }),
    type: virtualNumberTypeEnum("type").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    price: numeric("price", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    duration: varchar("duration", { length: 40 }).notNull(),
    smsCapable: boolean("sms_capable").notNull().default(true),
    stockBuy: integer("stock_buy").notNull().default(0),
    stockRent: integer("stock_rent").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("virtual_number_offers_country_type_idx").on(t.countryCode, t.type),
  ],
);

export const userVirtualNumbers = pgTable(
  "user_virtual_numbers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => virtualNumberOffers.id),
    phoneNumber: varchar("phone_number", { length: 32 }).notNull(),
    type: virtualNumberTypeEnum("type").notNull(),
    status: orderStatusEnum("status").notNull().default("completed"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("user_virtual_numbers_user_idx").on(t.userId)],
);

export const virtualNumberSms = pgTable(
  "virtual_number_sms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userVirtualNumberId: uuid("user_virtual_number_id")
      .notNull()
      .references(() => userVirtualNumbers.id, { onDelete: "cascade" }),
    fromNumber: varchar("from_number", { length: 32 }),
    body: text("body").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [index("virtual_number_sms_number_idx").on(t.userVirtualNumberId)],
);

// ─── 7. Social boosting ──────────────────────────────────────────────────────

export const socialPackages = pgTable(
  "social_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    metric: varchar("metric", { length: 40 }).notNull(),
    quantity: varchar("quantity", { length: 40 }).notNull(),
    price: numeric("price", { precision: 18, scale: 2 }).notNull(),
    delivery: varchar("delivery", { length: 40 }).notNull(),
    popular: boolean("popular").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("social_packages_country_platform_idx").on(
      t.countryCode,
      t.platform,
    ),
  ],
);

export const socialOrders = pgTable(
  "social_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packageId: uuid("package_id")
      .notNull()
      .references(() => socialPackages.id),
    profileUrl: text("profile_url").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    deliveryEta: varchar("delivery_eta", { length: 40 }),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    providerRef: varchar("provider_ref", { length: 120 }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (t) => [index("social_orders_user_idx").on(t.userId)],
);

// ─── 8. Gift cards (Phase 1 — coming soon) ───────────────────────────────────

export const giftCardBrands = pgTable("gift_card_brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  category: varchar("category", { length: 80 }).notNull(),
  color: varchar("color", { length: 16 }),
  status: giftCardBrandStatusEnum("status").notNull().default("soon"),
  ...timestamps,
});

export const giftCardRates = pgTable(
  "gift_card_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => giftCardBrands.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    buyRate: numeric("buy_rate", { precision: 18, scale: 4 }).notNull(),
    sellRate: numeric("sell_rate", { precision: 18, scale: 4 }).notNull(),
    status: giftCardBrandStatusEnum("status").notNull().default("soon"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("gift_card_rates_brand_country_uidx").on(
      t.brandId,
      t.countryCode,
    ),
  ],
);

export const giftCardOrders = pgTable(
  "gift_card_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 32 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => giftCardBrands.id),
    side: giftCardSideEnum("side").notNull(),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),
    localAmount: numeric("local_amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    cardImageUrl: text("card_image_url"),
    cardCodeEncrypted: text("card_code_encrypted"),
    status: orderStatusEnum("status").notNull().default("pending"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    reviewedByAdminId: uuid("reviewed_by_admin_id"),
    ...timestamps,
  },
  (t) => [
    index("gift_card_orders_user_idx").on(t.userId),
    index("gift_card_orders_status_idx").on(t.status),
  ],
);

export const giftCardWaitlist = pgTable(
  "gift_card_waitlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    email: varchar("email", { length: 255 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).references(
      () => countries.code,
    ),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("gift_card_waitlist_email_uidx").on(t.email)],
);

// ─── 9. Referrals ────────────────────────────────────────────────────────────

export const referralCodes = pgTable(
  "referral_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    code: varchar("code", { length: 40 }).notNull().unique(),
    status: referralStatusEnum("status").notNull().default("active"),
    joinsCount: integer("joins_count").notNull().default(0),
    earnings: numeric("earnings", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    ...timestamps,
  },
  (t) => [index("referral_codes_code_idx").on(t.code)],
);

export const referralEvents = pgTable(
  "referral_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => referralCodes.id, { onDelete: "cascade" }),
    referrerUserId: uuid("referrer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredUserId: uuid("referred_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    rewardAmount: numeric("reward_amount", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("referral_events_referrer_idx").on(t.referrerUserId)],
);

// ─── 10. Notifications ───────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    type: varchar("type", { length: 40 }).notNull().default("system"),
    unread: boolean("unread").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index("notifications_user_unread_idx").on(t.userId, t.unread),
    index("notifications_created_idx").on(t.createdAt),
  ],
);

export const notificationCampaigns = pgTable("notification_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  audience: varchar("audience", { length: 120 }).notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdByAdminId: uuid("created_by_admin_id"),
  ...timestamps,
});

// ─── 11. Support ─────────────────────────────────────────────────────────────

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 32 }).notNull().unique(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    topic: varchar("topic", { length: 80 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    message: text("message").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    assignedAdminId: uuid("assigned_admin_id"),
    ...timestamps,
  },
  (t) => [
    index("support_tickets_user_idx").on(t.userId),
    index("support_tickets_status_idx").on(t.status),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    sender: supportSenderEnum("sender").notNull(),
    senderUserId: uuid("sender_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    senderAdminId: uuid("sender_admin_id"),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("support_messages_ticket_idx").on(t.ticketId)],
);

// ─── 12. Admin ───────────────────────────────────────────────────────────────

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  passcodeHash: text("passcode_hash"),
  role: adminRoleEnum("role").notNull().default("admin"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("admin_sessions_admin_idx").on(t.adminId)],
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: varchar("entity_id", { length: 80 }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 64 }),
    ...timestamps,
  },
  (t) => [
    index("admin_audit_logs_admin_idx").on(t.adminId),
    index("admin_audit_logs_created_idx").on(t.createdAt),
  ],
);

export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: text("description"),
  ...timestamps,
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const countriesRelations = relations(countries, ({ many }) => ({
  users: many(users),
  banks: many(banks),
  gateways: many(countryGateways),
  networks: many(telecomNetworks),
  billProviders: many(billProviders),
  socialPackages: many(socialPackages),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  country: one(countries, {
    fields: [users.countryCode],
    references: [countries.code],
  }),
  security: one(userSecurity, {
    fields: [users.id],
    references: [userSecurity.userId],
  }),
  wallets: many(wallets),
  bankAccounts: many(userBankAccounts),
  depositAccount: one(userDepositAccounts, {
    fields: [users.id],
    references: [userDepositAccounts.userId],
  }),
  transactions: many(transactions),
  notifications: many(notifications),
  referralCode: one(referralCodes, {
    fields: [users.id],
    references: [referralCodes.userId],
  }),
}));

export const userDepositAccountsRelations = relations(
  userDepositAccounts,
  ({ one }) => ({
    user: one(users, {
      fields: [userDepositAccounts.userId],
      references: [users.id],
    }),
  }),
);

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
  transactions: many(transactions),
  fundings: many(walletFundings),
  withdrawals: many(withdrawals),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
}));

export const telecomNetworksRelations = relations(
  telecomNetworks,
  ({ one, many }) => ({
    country: one(countries, {
      fields: [telecomNetworks.countryCode],
      references: [countries.code],
    }),
    dataPlans: many(dataPlans),
  }),
);

export const dataPlansRelations = relations(dataPlans, ({ one }) => ({
  network: one(telecomNetworks, {
    fields: [dataPlans.networkId],
    references: [telecomNetworks.id],
  }),
}));

export const billProvidersRelations = relations(billProviders, ({ one }) => ({
  country: one(countries, {
    fields: [billProviders.countryCode],
    references: [countries.code],
  }),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  sessions: many(adminSessions),
  auditLogs: many(adminAuditLogs),
}));

export const referralCodesRelations = relations(
  referralCodes,
  ({ one, many }) => ({
    user: one(users, {
      fields: [referralCodes.userId],
      references: [users.id],
    }),
    events: many(referralEvents),
  }),
);

export const supportTicketsRelations = relations(
  supportTickets,
  ({ one, many }) => ({
    user: one(users, {
      fields: [supportTickets.userId],
      references: [users.id],
    }),
    messages: many(supportMessages),
  }),
);
