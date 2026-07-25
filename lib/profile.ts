import type { SyncedUser } from "@/lib/auth/sync-user";

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  KE: "Kenya",
  ZA: "South Africa",
};

const KYC_LABELS: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

const DAILY_LIMITS: Record<string, string> = {
  unverified: "₦50,000.00",
  pending: "₦200,000.00",
  verified: "₦5,000,000.00",
  rejected: "₦0.00",
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
      ? (COUNTRY_NAMES[user.countryCode] ?? user.countryCode)
      : "Not set",
    kycStatus: user.kycStatus,
    kycLabel: KYC_LABELS[user.kycStatus] ?? user.kycStatus,
    status: user.status,
    dailyLimitLabel: DAILY_LIMITS[user.kycStatus] ?? "₦50,000.00",
    emailVerified: Boolean(user.emailVerifiedAt),
    initials: initials || "OR",
  };
}
