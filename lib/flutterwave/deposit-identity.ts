import { desc, eq } from "drizzle-orm";
import { normalizeKycLevel } from "@/lib/account-levels";
import { resolveCountryCode } from "@/lib/country";
import { db } from "@/lib/db";
import { kycSubmissions, users } from "@/lib/db/schema";
import { isFlutterwaveDemoMode } from "@/lib/flutterwave/client";

export type DepositIdentity = {
  bvn?: string;
  nin?: string;
};

export type DepositIdentityRequired = {
  required: true;
  idTypes: Array<"BVN" | "NIN">;
  message: string;
  kycStatus: string;
  kycLevel: number;
  hasPendingKyc: boolean;
};

function extractIdentityFromRow(
  row: typeof kycSubmissions.$inferSelect,
  current: DepositIdentity,
): DepositIdentity {
  const type = (row.idType || "").toLowerCase();
  const number = (row.idNumber || "").replace(/\D/g, "");
  if (number.length !== 11) return current;

  const next = { ...current };
  if (type.includes("bvn") && !next.bvn) next.bvn = number;
  if (
    (type.includes("nin") || type.includes("national")) &&
    !next.nin
  ) {
    next.nin = number;
  }
  if (
    !next.nin &&
    !type.includes("bvn") &&
    !type.includes("passport") &&
    !type.includes("driver") &&
    !type.includes("utility")
  ) {
    next.nin = number;
  }
  return next;
}

/** Pull BVN/NIN from verified KYC first, then any saved submission. */
export async function getUserDepositIdentity(
  userId: string,
): Promise<DepositIdentity> {
  const rows = await db.query.kycSubmissions.findMany({
    where: eq(kycSubmissions.userId, userId),
    orderBy: [desc(kycSubmissions.createdAt)],
  });

  const verified = rows.filter((row) => row.status === "verified");
  const rest = rows.filter((row) => row.status !== "verified");

  let identity: DepositIdentity = {};
  for (const row of [...verified, ...rest]) {
    identity = extractIdentityFromRow(row, identity);
    if (identity.bvn && identity.nin) break;
  }

  const envBvn = process.env.FLUTTERWAVE_DVA_BVN?.replace(/\D/g, "");
  const envNin = process.env.FLUTTERWAVE_DVA_NIN?.replace(/\D/g, "");
  if (!identity.bvn && envBvn?.length === 11) identity.bvn = envBvn;
  if (!identity.nin && envNin?.length === 11) identity.nin = envNin;

  return identity;
}

export function nigerianDepositIdentityRequired(
  countryCode?: string | null,
) {
  if (resolveCountryCode(countryCode) !== "NG") return false;
  if (isFlutterwaveDemoMode()) return false;
  return true;
}

export async function buildDepositIdentityRequired(
  user: typeof users.$inferSelect,
): Promise<DepositIdentityRequired> {
  const latest = await db.query.kycSubmissions.findFirst({
    where: eq(kycSubmissions.userId, user.id),
    orderBy: [desc(kycSubmissions.createdAt)],
  });

  const kycStatus = user.kycStatus || "unverified";
  const kycLevel = normalizeKycLevel(user.kycLevel);
  const hasPendingKyc =
    kycStatus === "pending" || latest?.status === "pending";

  let message =
    "Enter your BVN or NIN to generate your dedicated bank account number.";
  if (hasPendingKyc) {
    message =
      "We need your BVN or NIN on file to create your fund account. Add it below or complete verification in Settings.";
  } else if (kycLevel === 0) {
    message =
      "Verify your identity with BVN or NIN to get your dedicated fund account.";
  }

  return {
    required: true,
    idTypes: ["BVN", "NIN"],
    message,
    kycStatus,
    kycLevel,
    hasPendingKyc,
  };
}

export async function saveDepositIdentity(
  userId: string,
  input: { idType: "BVN" | "NIN"; idNumber: string },
) {
  const digits = input.idNumber.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits)) {
    throw new Error(
      input.idType === "BVN"
        ? "BVN must be exactly 11 digits."
        : "NIN must be exactly 11 digits.",
    );
  }

  const targetLevel = input.idType === "BVN" ? 2 : 1;
  const latest = await db.query.kycSubmissions.findFirst({
    where: eq(kycSubmissions.userId, userId),
    orderBy: [desc(kycSubmissions.createdAt)],
  });

  const payload = {
    targetLevel,
    idType: input.idType,
    idNumber: digits,
    step: targetLevel,
    status: "pending" as const,
    rejectionReason: null as string | null,
    updatedAt: new Date(),
  };

  if (
    latest &&
    latest.status !== "verified" &&
    normalizeKycLevel(latest.targetLevel) === targetLevel
  ) {
    await db
      .update(kycSubmissions)
      .set(payload)
      .where(eq(kycSubmissions.id, latest.id));
  } else {
    await db.insert(kycSubmissions).values({
      userId,
      ...payload,
    });
  }

  if (input.idType === "BVN") {
    return { bvn: digits, nin: undefined };
  }
  return { bvn: undefined, nin: digits };
}
