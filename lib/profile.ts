import type { SyncedUser } from "@/lib/auth/sync-user";
import {
  dailyLimitForLevel,
  formatLevelLimit,
  KYC_LABELS,
  normalizeKycLevel,
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
    kycLabel: KYC_LABELS[user.kycStatus] ?? user.kycStatus,
    status: user.status,
    dailyLimitLabel: formatLevelLimit(
      dailyLimitForLevel(kycLevel),
      user.countryCode,
    ),
    emailVerified: Boolean(user.emailVerifiedAt),
    initials: initials || "OR",
  };
}
