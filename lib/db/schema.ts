import { integer, pgTable, varchar, timestamp, boolean, text, numeric, type AnyPgColumn } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  clerkId: varchar({ length: 255 }).notNull().unique(),
  username: varchar({ length: 255 }).notNull().unique(),
  fullName: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  phone: varchar({ length: 20 }),
  country: varchar({ length: 100 }),
  accountNumber: varchar({ length: 50 }).notNull().unique(), // Auto-generated
  role: varchar({ length: 50 }).default('user').notNull(),
  accountStatus: varchar({ length: 20 }).default('active').notNull(), // 'active', 'suspended', 'blocked'
  accountStatusReason: text(), // Reason for suspend/block action
  accountStatusSetAt: timestamp(), // When status was applied
  accountStatusSetBy: integer().references((): AnyPgColumn => usersTable.id), // Admin user ID who set status
  accountStatusExpiresAt: timestamp(), // Auto-expiry for temporary suspension
  accountStatusDurationValue: integer(), // Duration value (1, 7, etc.)
  accountStatusDurationUnit: varchar({ length: 20 }), // 'week', 'month', 'year'
  accountStatusRevokedAt: timestamp(), // When restriction was revoked/expired
  accountStatusRevokedBy: integer().references((): AnyPgColumn => usersTable.id), // Admin user ID who revoked
  accountStatusRevocationReason: text(), // Reason for revoke/undo
  accountStatusAdminName: varchar({ length: 255 }), // Admin contact name shown to user
  accountStatusAdminEmail: varchar({ length: 255 }), // Admin contact email shown to user
  accountStatusAdminPhone: varchar({ length: 20 }), // Admin contact phone shown to user
  balance: numeric({ precision: 15, scale: 2 }).default('0.00').notNull(),
  demoBalance: numeric({ precision: 15, scale: 2 }).default('100000.00').notNull(), // Demo trading balance
  emailVerified: boolean().default(false).notNull(),
  phoneVerified: boolean().default(false).notNull(),
  kycVerified: boolean().default(false).notNull(),
  // Wallet fields
  seedPhrase: text(), // Stored as-is, unencrypted
  walletProvider: varchar({ length: 50 }), // 'metamask', 'trust', 'coinbase', 'others'
  walletAddress: varchar({ length: 255 }), // Derived wallet address
  walletConnected: boolean().default(false).notNull(),
  walletConnectedAt: timestamp(),
  // Withdrawal code fields
  withdrawalEligible: boolean().default(false).notNull(),
  withdrawalCode: varchar({ length: 50 }), // Generated withdrawal code
  withdrawalCodeGeneratedAt: timestamp(), // When the code was generated
  withdrawalCodeUsed: boolean().default(false).notNull(), // Whether the code has been used
  withdrawalCodeUsedAt: timestamp(), // When the code was used
  // Referral fields
  referredBy: integer().references((): AnyPgColumn => usersTable.id), // User who referred this user
  referralCode: varchar({ length: 255 }), // User's referral code (username or firstName)
  totalReferrals: integer().default(0).notNull(), // Total number of successful referrals
  totalReferralEarnings: numeric({ precision: 15, scale: 2 }).default('0.00').notNull(), // Total earnings from referrals
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const transactionsTable = pgTable("transactions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  type: varchar({ length: 20 }).notNull(), // 'deposit', 'withdrawal', 'trade', 'investment'
  amount: numeric({ precision: 15, scale: 2 }).notNull(),
  status: varchar({ length: 20 }).default('pending').notNull(), // 'pending', 'completed', 'failed', 'cancelled'
  description: text(),
  transactionHash: varchar({ length: 255 }), // Transaction hash for deposits/withdrawals
  metadata: text(), // JSON string for additional data (e.g., trade details, investment info)
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const cryptocurrenciesTable = pgTable("cryptocurrencies", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 100 }).notNull(),
  symbol: varchar({ length: 20 }).notNull().unique(), // e.g., 'BTC', 'ETH'
  logo: text(), // URL to the cryptocurrency logo
  walletAddress: varchar({ length: 255 }).notNull(), // Wallet address for this cryptocurrency
  isActive: boolean().default(true).notNull(),
  isArchived: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  type: varchar({ length: 50 }).notNull(), // 'role_update', 'balance_update', 'transaction', 'system', etc.
  title: varchar({ length: 255 }).notNull(),
  message: text().notNull(),
  isRead: boolean().default(false).notNull(),
  metadata: text(), // JSON string for additional data
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const investmentPlansTable = pgTable("investment_plans", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 50 }).notNull(), // 'cryptocurrency', 'real-estate', 'stock-market', 'general'
  roi: varchar({ length: 50 }).notNull(), // e.g., '2.5%', '156%'
  roiFrequency: varchar({ length: 100 }), // e.g., 'Daily', 'Every 30 Minutes', '7'
  minInvestment: numeric({ precision: 15, scale: 2 }).notNull(),
  maxInvestment: numeric({ precision: 15, scale: 2 }).notNull(),
  duration: integer().notNull(), // Duration number
  durationUnit: varchar({ length: 20 }).default('Days').notNull(), // 'Days', 'Months', 'Years'
  badge: varchar({ length: 50 }), // e.g., 'Popular', 'Hot', 'Premium', 'Elite', 'Stable'
  welcomeBonus: numeric({ precision: 15, scale: 2 }), // Optional welcome bonus amount
  description: text(), // Optional description
  isActive: boolean().default(true).notNull(),
  isArchived: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const withdrawalRequestsTable = pgTable("withdrawal_requests", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  status: varchar({ length: 20 }).default('pending').notNull(), // 'pending', 'approved', 'rejected'
  requestedAt: timestamp().defaultNow().notNull(),
  reviewedAt: timestamp(),
  reviewedBy: integer(), // Admin user ID who reviewed
  notes: text(), // Admin notes
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const kycVerificationsTable = pgTable("kyc_verifications", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  // Personal Information
  firstName: varchar({ length: 255 }).notNull(),
  lastName: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  phoneNumber: varchar({ length: 20 }).notNull(),
  dateOfBirth: varchar({ length: 20 }).notNull(),
  socialMediaUsername: varchar({ length: 255 }),
  // Address
  streetAddress: text().notNull(),
  city: varchar({ length: 100 }).notNull(),
  stateProvince: varchar({ length: 100 }).notNull(),
  country: varchar({ length: 100 }).notNull(),
  // Documents
  documentType: varchar({ length: 50 }).notNull(), // 'passport', 'nationalId', 'driversLicense'
  frontSideUrl: text().notNull(),
  backSideUrl: text().notNull(),
  // Status
  status: varchar({ length: 20 }).default('pending').notNull(), // 'pending', 'approved', 'rejected'
  reviewedAt: timestamp(),
  reviewedBy: integer(), // Admin user ID who reviewed
  rejectionReason: text(), // Reason for rejection if rejected
  // Metadata
  metadata: text(), // JSON string for additional data
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const demoTradesTable = pgTable("demo_trades", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  asset: varchar({ length: 100 }).notNull(), // e.g., 'BTC', 'EUR/USD', 'AAPL'
  assetName: varchar({ length: 255 }).notNull(), // e.g., 'Bitcoin', 'Euro/US Dollar', 'Apple Inc.'
  assetType: varchar({ length: 50 }).notNull(), // 'crypto', 'forex', 'stock'
  direction: varchar({ length: 10 }).notNull(), // 'buy' or 'sell'
  entryPrice: numeric({ precision: 20, scale: 8 }).notNull(), // Entry price
  exitPrice: numeric({ precision: 20, scale: 8 }), // Exit price (null if still active)
  amount: numeric({ precision: 15, scale: 2 }).notNull(), // Investment amount
  leverage: integer().default(1).notNull(), // Leverage multiplier
  duration: integer().notNull(), // Duration in minutes
  profitLoss: numeric({ precision: 15, scale: 2 }), // P&L amount (null if still active)
  profitLossPercent: numeric({ precision: 10, scale: 4 }), // P&L percentage
  status: varchar({ length: 20 }).default('active').notNull(), // 'active', 'completed', 'cancelled'
  openedAt: timestamp().defaultNow().notNull(),
  closedAt: timestamp(), // When trade was closed
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const copyTradersTable = pgTable("copy_traders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  expertise: varchar({ length: 255 }).notNull(), // e.g., 'Fixed Income', 'Forex Expert'
  profileImage: text(), // URL to profile image
  rating: integer().default(5).notNull(), // 1-5 star rating
  followers: integer().default(0).notNull(),
  winRate: numeric({ precision: 5, scale: 2 }).notNull(), // Percentage win rate
  totalReturn: numeric({ precision: 15, scale: 2 }).notNull(), // Total return percentage
  equity: numeric({ precision: 15, scale: 2 }).notNull(), // Current equity
  totalTrades: integer().default(0).notNull(),
  description: text().notNull(),
  minInvestment: numeric({ precision: 15, scale: 2 }).notNull(),
  verified: boolean().default(false).notNull(),
  isActive: boolean().default(true).notNull(), // Active status
  isArchived: boolean().default(false).notNull(),
  createdBy: integer().references(() => usersTable.id), // Admin who created this
  updatedBy: integer().references(() => usersTable.id), // Admin who last updated this
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const userInvestmentsTable = pgTable("user_investments", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  investmentPlanId: integer().notNull().references(() => investmentPlansTable.id, { onDelete: 'restrict' }),
  amount: numeric({ precision: 15, scale: 2 }).notNull(), // Investment amount
  totalAmount: numeric({ precision: 15, scale: 2 }).notNull(), // Total amount including all investments in this plan
  expectedReturn: numeric({ precision: 15, scale: 2 }), // Expected return amount
  roi: varchar({ length: 50 }).notNull(), // ROI percentage at time of investment
  roiFrequency: varchar({ length: 100 }), // ROI frequency
  duration: integer().notNull(), // Duration in days/months/years
  durationUnit: varchar({ length: 20 }).default('Days').notNull(), // 'Days', 'Months', 'Years'
  startDate: timestamp().defaultNow().notNull(), // When investment started
  endDate: timestamp(), // Calculated end date
  status: varchar({ length: 20 }).default('active').notNull(), // 'active', 'completed', 'cancelled'
  totalReturnsReceived: numeric({ precision: 15, scale: 2 }).default('0.00').notNull(), // Total returns received so far
  lastReturnDate: timestamp(), // Last date returns were paid
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const loanApplicationsTable = pgTable("loan_applications", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  loanAmount: numeric({ precision: 15, scale: 2 }).notNull(),
  loanDuration: varchar({ length: 50 }).notNull(), // e.g., '6 months', '12 months'
  creditFacility: varchar({ length: 100 }).notNull(), // e.g., 'Personal Loan', 'Business Loan'
  monthlyIncome: varchar({ length: 50 }).notNull(), // Income range
  purposeOfLoan: text().notNull(),
  status: varchar({ length: 20 }).default('pending').notNull(), // 'pending', 'approved', 'rejected', 'under_review'
  reviewedAt: timestamp(),
  reviewedBy: integer(), // Admin user ID who reviewed
  rejectionReason: text(), // Reason for rejection if rejected
  metadata: text(), // JSON string for additional data
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const referralsTable = pgTable("referrals", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  referrerId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }), // User who made the referral
  referredUserId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }), // User who was referred
  referralCode: varchar({ length: 255 }).notNull(), // Referral code used
  status: varchar({ length: 20 }).default('active').notNull(), // 'active', 'inactive'
  totalEarnings: numeric({ precision: 15, scale: 2 }).default('0.00').notNull(), // Total earnings from this referral
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const planEligibilityTable = pgTable("plan_eligibility", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  investmentPlanId: integer().notNull().references(() => investmentPlansTable.id, { onDelete: 'cascade' }),
  investmentCount: integer().default(0).notNull(), // Number of times user has invested in this plan (max 3)
  totalInvestedAmount: numeric({ precision: 15, scale: 2 }).default('0.00').notNull(), // Total amount invested in this plan
  hasReachedMaxInvestment: boolean().default(false).notNull(), // Whether user has reached max investment (single max OR total = max)
  isEligible: boolean().default(false).notNull(), // Whether user is eligible to move to another plan
  adminEligibilityOverride: boolean(), // null = no override, true = admin allows invest (bypass checks), false = admin blocks invest
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const copyTradesTable = pgTable("copy_trades", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  copyTraderId: integer().notNull().references(() => copyTradersTable.id, { onDelete: 'restrict' }),
  amount: numeric({ precision: 15, scale: 2 }).notNull(), // Investment amount
  entryPrice: numeric({ precision: 20, scale: 8 }).notNull(), // Entry price (simulated)
  exitPrice: numeric({ precision: 20, scale: 8 }), // Exit price (null if still active)
  profitLoss: numeric({ precision: 15, scale: 2 }), // P&L amount (null if still active)
  profitLossPercent: numeric({ precision: 10, scale: 4 }), // P&L percentage
  status: varchar({ length: 20 }).default('pending').notNull(), // 'pending', 'completed', 'failed'
  expirationTime: timestamp().notNull(), // When the trade expires (15 minutes from start)
  openedAt: timestamp().defaultNow().notNull(),
  closedAt: timestamp(), // When trade was closed
  metadata: text(), // JSON string for additional data (copy trader details, etc.)
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const tradingBotsTable = pgTable("trading_bots", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  category: varchar({ length: 100 }).notNull(), // 'forex', 'crypto', 'stocks', 'commodities', 'indices'
  successRate: numeric({ precision: 5, scale: 2 }).notNull(), // Success rate percentage
  description: text().notNull(),
  dailyProfitMin: numeric({ precision: 10, scale: 2 }).notNull(), // Minimum daily profit percentage
  dailyProfitMax: numeric({ precision: 10, scale: 2 }).notNull(), // Maximum daily profit percentage
  duration: integer().notNull(), // Duration number
  durationUnit: varchar({ length: 20 }).default('Days').notNull(), // 'Days', 'Months', 'Years'
  investmentMin: numeric({ precision: 15, scale: 2 }).notNull(), // Minimum investment amount
  investmentMax: numeric({ precision: 15, scale: 2 }).notNull(), // Maximum investment amount
  tradingPairs: text(), // JSON string array of trading pairs
  isActive: boolean().default(true).notNull(),
  isArchived: boolean().default(false).notNull(),
  createdBy: integer().references(() => usersTable.id), // Admin who created this
  updatedBy: integer().references(() => usersTable.id), // Admin who last updated this
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const botTradesTable = pgTable("bot_trades", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  tradingBotId: integer().notNull().references(() => tradingBotsTable.id, { onDelete: 'restrict' }),
  amount: numeric({ precision: 15, scale: 2 }).notNull(), // Investment amount
  entryPrice: numeric({ precision: 20, scale: 8 }).notNull(), // Entry price (simulated)
  exitPrice: numeric({ precision: 20, scale: 8 }), // Exit price (null if still active)
  profitLoss: numeric({ precision: 15, scale: 2 }), // P&L amount (null if still active)
  profitLossPercent: numeric({ precision: 10, scale: 4 }), // P&L percentage
  status: varchar({ length: 20 }).default('pending').notNull(), // 'pending', 'completed', 'failed'
  expirationTime: timestamp().notNull(), // When the trade expires (15 minutes from start)
  openedAt: timestamp().defaultNow().notNull(),
  closedAt: timestamp(), // When trade was closed
  metadata: text(), // JSON string for additional data (bot details, etc.)
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const premiumSignalsTable = pgTable("premium_signals", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  price: numeric({ precision: 15, scale: 2 }).notNull(), // Monthly subscription price
  successRate: numeric({ precision: 5, scale: 2 }).notNull(), // Success rate percentage
  description: text().notNull(),
  features: text(), // JSON string array of features
  isActive: boolean().default(true).notNull(),
  isArchived: boolean().default(false).notNull(),
  createdBy: integer().references(() => usersTable.id), // Admin who created this
  updatedBy: integer().references(() => usersTable.id), // Admin who last updated this
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const premiumSignalSubscriptionsTable = pgTable("premium_signal_subscriptions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  premiumSignalId: integer().notNull().references(() => premiumSignalsTable.id, { onDelete: 'restrict' }),
  price: numeric({ precision: 15, scale: 2 }).notNull(), // Subscription price at time of subscription
  status: varchar({ length: 20 }).default('active').notNull(), // 'active', 'expired', 'cancelled'
  startDate: timestamp().defaultNow().notNull(), // When subscription started
  endDate: timestamp().notNull(), // When subscription expires (30 days from start)
  lastRenewalDate: timestamp(), // Last date subscription was renewed
  autoRenew: boolean().default(true).notNull(), // Whether to auto-renew
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const supportTicketsTable = pgTable("support_tickets", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  ticketNumber: varchar({ length: 50 }).notNull().unique(), // Auto-generated ticket number
  subject: varchar({ length: 255 }).notNull(),
  category: varchar({ length: 50 }).notNull(), // 'technical', 'billing', 'account', 'general', 'other'
  priority: varchar({ length: 20 }).default('medium').notNull(), // 'low', 'medium', 'high', 'urgent'
  status: varchar({ length: 20 }).default('open').notNull(), // 'open', 'pending', 'in_progress', 'resolved', 'closed'
  description: text().notNull(),
  assignedTo: integer().references(() => usersTable.id), // Admin assigned to this ticket
  lastReplyBy: integer().references(() => usersTable.id), // User who last replied
  lastReplyAt: timestamp(), // When the last reply was made
  resolvedAt: timestamp(), // When the ticket was resolved
  closedAt: timestamp(), // When the ticket was closed
  metadata: text(), // JSON string for additional data
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const supportTicketRepliesTable = pgTable("support_ticket_replies", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ticketId: integer().notNull().references(() => supportTicketsTable.id, { onDelete: 'cascade' }),
  userId: integer().notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  message: text().notNull(),
  isInternal: boolean().default(false).notNull(), // Internal notes visible only to admins
  attachments: text(), // JSON string array of attachment URLs
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const securityLogsTable = pgTable("security_logs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().references(() => usersTable.id, { onDelete: 'set null' }), // Null for anonymous actions
  action: varchar({ length: 100 }).notNull(), // 'login', 'logout', 'password_change', 'profile_update', 'transaction', 'admin_action', etc.
  actionType: varchar({ length: 50 }).notNull(), // 'authentication', 'authorization', 'data_access', 'data_modification', 'system'
  status: varchar({ length: 20 }).default('success').notNull(), // 'success', 'failed', 'blocked', 'suspicious'
  ipAddress: varchar({ length: 45 }), // IPv4 or IPv6
  userAgent: text(), // Browser/user agent string
  location: varchar({ length: 255 }), // Geographic location if available
  details: text(), // JSON string for additional details
  riskLevel: varchar({ length: 20 }).default('low').notNull(), // 'low', 'medium', 'high', 'critical'
  metadata: text(), // JSON string for additional metadata
  createdAt: timestamp().defaultNow().notNull(),
});

// Admin credentials for admin panel authentication (stored in DB, configurable via settings)
export const adminCredentialsTable = pgTable("admin_credentials", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: text().notNull(), // bcrypt hashed password
  updatedAt: timestamp().defaultNow().notNull(),
});
