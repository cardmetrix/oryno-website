import { formatCountryMoney } from "@/lib/country";

export type AccountLevelId = 1 | 2 | 3;

export type AccountLevelKycStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type KycDocRules = {
  idTypes: string[];
  numberLabel: string;
  numberRequired: boolean;
  numberPlaceholder: string;
  frontLabel: string;
  frontRequired: boolean;
  backLabel?: string;
  backRequired: boolean;
  selfieRequired: boolean;
  helpText: string;
};

export type AccountLevelDef = {
  id: AccountLevelId;
  name: string;
  shortName: string;
  description: string;
  /** Daily limit in NGN. `null` = unlimited. */
  dailyLimitAmount: number | null;
  /** Documents required to unlock this level. */
  requirement: string;
  kyc: KycDocRules;
  features: string[];
};

export const ACCOUNT_LEVELS: AccountLevelDef[] = [
  {
    id: 1,
    name: "Level 1 · Identity",
    shortName: "Identity",
    description:
      "Verify with a government-issued ID to unlock your starter daily limit.",
    dailyLimitAmount: 50_000,
    requirement: "NIN, BVN, Passport, or Driver License",
    kyc: {
      idTypes: ["NIN", "BVN", "Passport", "Driver License"],
      numberLabel: "ID number",
      numberRequired: true,
      numberPlaceholder: "e.g. 12345678901",
      frontLabel: "ID front",
      frontRequired: true,
      backLabel: "ID back (optional)",
      backRequired: false,
      selfieRequired: true,
      helpText:
        "Verify with NIN, BVN, passport, or driver license. BVN only needs your 11-digit number; other IDs need a photo and selfie.",
    },
    features: [
      "Browse all digital services",
      "Buy airtime, data & bills",
      "Fund your wallet with a dedicated account",
      "₦50,000 daily limit",
      "Standard support response",
    ],
  },
  {
    id: 2,
    name: "Level 2 · BVN",
    shortName: "BVN",
    description: "Add your BVN if you verified with NIN, passport, or license at Level 1.",
    dailyLimitAmount: 500_000,
    requirement: "Bank Verification Number (BVN)",
    kyc: {
      idTypes: ["BVN"],
      numberLabel: "BVN",
      numberRequired: true,
      numberPlaceholder: "11-digit BVN",
      frontLabel: "BVN slip (optional)",
      frontRequired: false,
      backRequired: false,
      selfieRequired: false,
      helpText: "Enter the 11-digit BVN linked to your bank accounts.",
    },
    features: [
      "Everything in Level 1",
      "₦500,000 daily spend limit",
      "Faster gift-card trades",
      "Higher withdrawal capacity",
      "Email updates on verification",
    ],
  },
  {
    id: 3,
    name: "Level 3 · Address",
    shortName: "Address",
    description:
      "Submit proof of address for unrestricted daily limits.",
    dailyLimitAmount: null,
    requirement: "Proof of address (utility bill)",
    kyc: {
      idTypes: ["Utility Bill"],
      numberLabel: "Meter / account number (optional)",
      numberRequired: false,
      numberPlaceholder: "Optional reference on the bill",
      frontLabel: "Utility bill",
      frontRequired: true,
      backRequired: false,
      selfieRequired: false,
      helpText:
        "Upload a recent utility bill (electricity, water, or waste) showing your name and address.",
    },
    features: [
      "Everything in previous levels",
      "Unlimited daily wallet limit",
      "Unrestricted withdrawals & services",
      "Trusted seller badge",
      "Priority support",
    ],
  },
];

/** Fallback daily limit before Level 1 is approved. */
export const UNVERIFIED_DAILY_LIMIT = 50_000;

export const KYC_LABELS: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

export function getLevelDef(level: number): AccountLevelDef | null {
  if (level === 1 || level === 2 || level === 3) {
    return ACCOUNT_LEVELS[level - 1] ?? null;
  }
  return null;
}

/** Highest unlocked level (0 = none). */
export function normalizeKycLevel(level: unknown): 0 | 1 | 2 | 3 {
  const n = Number(level);
  if (n === 1 || n === 2 || n === 3) return n;
  return 0;
}

export function resolveUserLevel(kycLevel: number): AccountLevelDef {
  const level = normalizeKycLevel(kycLevel);
  if (level === 0) return ACCOUNT_LEVELS[0];
  return getLevelDef(level) ?? ACCOUNT_LEVELS[0];
}

export function nextKycLevel(kycLevel: number): AccountLevelId | null {
  const level = normalizeKycLevel(kycLevel);
  if (level >= 3) return null;
  return (level + 1) as AccountLevelId;
}

export function dailyLimitForLevel(kycLevel: number): number | null {
  const level = normalizeKycLevel(kycLevel);
  if (level === 0) return UNVERIFIED_DAILY_LIMIT;
  return getLevelDef(level)?.dailyLimitAmount ?? UNVERIFIED_DAILY_LIMIT;
}

export function formatLevelLimit(
  amount: number | null,
  countryCode?: string | null,
) {
  if (amount == null) return "Unlimited";
  return formatCountryMoney(amount, countryCode || "NG");
}

export function getAccountLevels(countryCode?: string | null) {
  return ACCOUNT_LEVELS.map((level) => ({
    ...level,
    dailyLimitLabel: formatLevelLimit(level.dailyLimitAmount, countryCode),
  }));
}

export function isValidIdTypeForLevel(
  level: AccountLevelId,
  idType: string | null | undefined,
) {
  const def = getLevelDef(level);
  if (!def || !idType) return false;
  return def.kyc.idTypes.some(
    (t) => t.toLowerCase() === idType.trim().toLowerCase(),
  );
}

export function isBvnIdType(idType?: string | null) {
  return (idType || "").trim().toLowerCase() === "bvn";
}

export function isNinIdType(idType?: string | null) {
  return (idType || "").trim().toLowerCase() === "nin";
}

/** Document rules vary by ID type at Level 1 (e.g. BVN is number-only). */
export function kycRulesForSubmission(
  level: AccountLevelId,
  idType: string,
): KycDocRules {
  const def = getLevelDef(level);
  if (!def) return ACCOUNT_LEVELS[0].kyc;

  if (level === 1 && isBvnIdType(idType)) {
    return {
      ...def.kyc,
      numberLabel: "BVN",
      numberRequired: true,
      numberPlaceholder: "11-digit BVN",
      frontLabel: "BVN slip (optional)",
      frontRequired: false,
      backRequired: false,
      selfieRequired: false,
      helpText: "Enter the 11-digit BVN linked to your bank accounts.",
    };
  }

  if (level === 1 && isNinIdType(idType)) {
    return {
      ...def.kyc,
      numberLabel: "NIN",
      numberRequired: true,
      numberPlaceholder: "11-digit NIN",
      helpText:
        "Upload a clear photo of your NIN slip plus a selfie, and enter your 11-digit NIN.",
    };
  }

  return def.kyc;
}

export function levelCta(input: {
  kycLevel: number;
  kycStatus: string;
}): {
  label: string;
  href: "/settings" | "/profile";
  disabled: boolean;
  variant: "primary" | "secondary";
} {
  const level = normalizeKycLevel(input.kycLevel);
  const status = (input.kycStatus || "unverified").toLowerCase();

  if (level >= 3) {
    return {
      label: "Fully verified",
      href: "/profile",
      disabled: true,
      variant: "secondary",
    };
  }
  if (status === "pending") {
    return {
      label: "View KYC status",
      href: "/settings",
      disabled: false,
      variant: "primary",
    };
  }
  const next = nextKycLevel(level);
  return {
    label:
      status === "rejected"
        ? "Resubmit verification"
        : next
          ? `Upgrade to Level ${next}`
          : "Get verified",
    href: "/settings",
    disabled: false,
    variant: "primary",
  };
}
