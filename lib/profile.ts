import type { SyncedUser } from "@/lib/auth/sync-user";
import { formatCountryMoney, getCountryInfo } from "@/lib/country";

const KYC_LABELS: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

const DAILY_LIMIT_AMOUNTS: Record<string, number> = {
  unverified: 50_000,
  pending: 200_000,
  verified: 5_000_000,
  rejected: 0,
};

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
  kycStatus: string;
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
    kycStatus: user.kycStatus,
    kycLabel: KYC_LABELS[user.kycStatus] ?? user.kycStatus,
    status: user.status,
    dailyLimitLabel: formatCountryMoney(
      DAILY_LIMIT_AMOUNTS[user.kycStatus] ?? 50_000,
      user.countryCode,
    ),
    emailVerified: Boolean(user.emailVerifiedAt),
    initials: initials || "OR",
  };
}
