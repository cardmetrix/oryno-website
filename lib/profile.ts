import type { SyncedUser } from "@/lib/auth/sync-user";
import {
  dailyLimitForLevel,
  formatLevelLimit,
  KYC_LABELS,
  normalizeKycLevel,
  resolveUserLevel,
} from "@/lib/account-levels";
import { getCountryInfo } from "@/lib/country";

export type ProfileDto = {
  id: string;
  clerkId: string | null;
  username: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  countryName: string;
  role: "user" | "admin";
  kycStatus: string;
  kycLevel: number;
  kycLabel: string;
  accountLevelName: string;
  status: string;
  dailyLimitLabel: string;
  emailVerified: boolean;
  initials: string;
};

export function toProfileDto(
  user: SyncedUser,
  extras?: { clerkImageUrl?: string | null },
): ProfileDto {
  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const kycLevel = normalizeKycLevel(
    (user as SyncedUser & { kycLevel?: number }).kycLevel,
  );
  const level = resolveUserLevel(kycLevel);

  return {
    id: user.id,
    clerkId: user.clerkId,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl || extras?.clerkImageUrl || null,
    countryCode: user.countryCode,
    countryName: user.countryCode
      ? getCountryInfo(user.countryCode).name
      : "Not set",
    role: user.role === "admin" ? "admin" : "user",
    kycStatus: user.kycStatus,
    kycLevel,
    kycLabel:
      kycLevel > 0
        ? `Level ${kycLevel} · ${KYC_LABELS[user.kycStatus] ?? user.kycStatus}`
        : (KYC_LABELS[user.kycStatus] ?? user.kycStatus),
    accountLevelName: kycLevel > 0 ? level.name : "Unverified",
    status: user.status,
    dailyLimitLabel: formatLevelLimit(
      dailyLimitForLevel(kycLevel),
      user.countryCode,
    ),
    emailVerified: Boolean(user.emailVerifiedAt),
    initials: initials || "OR",
  };
}
