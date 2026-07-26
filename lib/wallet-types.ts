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
  accountName: string;
  accountNumber: string;
  isPrimary: boolean;
  verified: boolean;
  maskedNumber: string;
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
  wallets: WalletSummary[];
  banks: BankAccountSummary[];
  recent: Array<{
    id: string;
    title: string;
    subtitle: string;
    amount: string;
    type: "credit" | "debit";
    status: "Completed" | "Pending" | "Failed";
    category?: string;
    currency?: string;
    createdAt: string;
  }>;
  totals: {
    balance: string;
    balanceFormatted: string;
    currency: string;
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
