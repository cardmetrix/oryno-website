import { formatCountryMoney } from "@/lib/country";

export type AccountLevelId = 1 | 2 | 3;

export type AccountLevelKycStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type AccountLevelDef = {
  id: AccountLevelId;
  name: string;
  shortName: string;
  description: string;
  /** Base daily limit in NGN (display converted via country FX helpers). */
  dailyLimitAmount: number;
  /** KYC statuses that place the user on this level. */
  kycStatuses: AccountLevelKycStatus[];
  features: string[];
};

export const ACCOUNT_LEVELS: AccountLevelDef[] = [
  {
    id: 1,
    name: "Level 1 · Starter",
    shortName: "Starter",
    description:
      "Get started with ORYNO using basic wallet and service access.",
    dailyLimitAmount: 50_000,
    kycStatuses: ["unverified", "rejected"],
    features: [
      "Browse all digital services",
      "Buy airtime and data",
      "Fund your wallet",
      "Limited gift-card selling",
      "Standard support response",
    ],
  },
  {
    id: 2,
    name: "Level 2 · In review",
    shortName: "In review",
    description:
      "Documents submitted — higher limits while we verify your identity.",
    dailyLimitAmount: 200_000,
    kycStatuses: ["pending"],
    features: [
      "Everything in Starter",
      "Higher daily spend limit",
      "Track KYC review status",
      "Faster gift-card trades",
      "Email updates on verification",
    ],
  },
  {
    id: 3,
    name: "Level 3 · Verified",
    shortName: "Verified",
    description:
      "Full access with the highest limits after identity verification.",
    dailyLimitAmount: 5_000_000,
    kycStatuses: ["verified"],
    features: [
      "Everything in previous levels",
      "Maximum daily wallet limit",
      "Unrestricted withdrawals & services",
      "Trusted seller badge",
      "Priority support",
    ],
  },
];

/** Daily limit amounts keyed by KYC status (rejected overrides to 0). */
export const DAILY_LIMIT_AMOUNTS: Record<string, number> = {
  unverified: 50_000,
  pending: 200_000,
  verified: 5_000_000,
  rejected: 0,
};

export const KYC_LABELS: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

export function resolveUserLevel(kycStatus: string): AccountLevelDef {
  const normalized = (kycStatus || "unverified").toLowerCase();
  const match = ACCOUNT_LEVELS.find((level) =>
    level.kycStatuses.includes(normalized as AccountLevelKycStatus),
  );
  return match ?? ACCOUNT_LEVELS[0];
}

export function formatLevelLimit(
  amount: number,
  countryCode?: string | null,
) {
  return formatCountryMoney(amount, countryCode || "NG");
}

export function getAccountLevels(countryCode?: string | null) {
  return ACCOUNT_LEVELS.map((level) => ({
    ...level,
    dailyLimitLabel: formatLevelLimit(level.dailyLimitAmount, countryCode),
  }));
}

export function levelCta(kycStatus: string): {
  label: string;
  href: "/settings/kyc" | "/profile";
  disabled: boolean;
  variant: "primary" | "secondary";
} {
  const status = (kycStatus || "unverified").toLowerCase();
  if (status === "verified") {
    return {
      label: "You’re verified",
      href: "/profile",
      disabled: true,
      variant: "secondary",
    };
  }
  if (status === "pending") {
    return {
      label: "View KYC status",
      href: "/settings/kyc",
      disabled: false,
      variant: "primary",
    };
  }
  return {
    label: status === "rejected" ? "Resubmit verification" : "Get verified",
    href: "/settings/kyc",
    disabled: false,
    variant: "primary",
  };
}
