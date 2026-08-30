export type WalletSummary = {
  id: string;
  currency: string;
  balance: string;
  balanceFormatted: string;
  status: "healthy" | "frozen" | "closed";
  isPrimary: boolean;
  dailyLimit: string | null;
  /** Unique virtual card number issued to this wallet */
  cardNumber: string;
  cardNumberMasked: string;
};

export type BankAccountSummary = {
  id: string;
  bankName: string;
  bankCode?: string | null;
  accountName: string;
  accountNumber: string;
  isPrimary: boolean;
  verified: boolean;
  maskedNumber: string;
};

export type BankOption = {
  name: string;
  code: string;
  type?: string;
};

export type FundingMethod =
  | "card"
  | "bank_transfer"
  | "ussd"
  | "mobile_money";

export const DEMO_BANKS = [
  "Access Bank",
  "GTBank",
  "Kuda",
  "Zenith Bank",
  "UBA",
  "First Bank",
  "Opay",
  "Palmpay",
  "Moniepoint",
] as const;

export type WalletPayload = {
  primary: WalletSummary;
  usd?: WalletSummary | null;
  wallets: WalletSummary[];
  banks: BankAccountSummary[];
  recent: Array<{
    id: string;
    title: string;
    subtitle: string;
    amount: string;
    type: "credit" | "debit";
    status: "Completed" | "Pending" | "Failed" | "Reversed";
    category?: string;
    currency?: string;
    createdAt: string;
  }>;
  fx?: {
    base: string;
    quote: string;
    midRate: number;
    buyRate: number;
    sellRate: number;
    commissionPercent: number;
    provider: string;
    asOf: string;
  } | null;
  totals: {
    balance: string;
    balanceFormatted: string;
    currency: string;
    usdBalance?: string;
    usdBalanceFormatted?: string;
    bankCount: number;
    txCount: number;
  };
  user: { fullName: string; countryCode: string };
  country?: {
    code: string;
    name: string;
    currency: string;
    currencySymbol: string;
    flagEmoji: string;
  };
};
