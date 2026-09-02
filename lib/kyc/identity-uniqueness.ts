import { and, eq, ne, not } from "drizzle-orm";
import { isBvnIdType, isNinIdType } from "@/lib/account-levels";
import { db } from "@/lib/db";
import { kycSubmissions } from "@/lib/db/schema";

export class IdentityConflictError extends Error {
  status = 409;
  code = "identity_conflict" as const;

  constructor(message: string) {
    super(message);
    this.name = "IdentityConflictError";
  }
}

function digitsOnly(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function rowMatchesIdentityKind(rowType: string, kind: "bvn" | "nin") {
  const type = rowType.toLowerCase();
  if (kind === "bvn") return type.includes("bvn");
  if (type.includes("nin") || type.includes("national")) return true;
  return (
    !type.includes("bvn") &&
    !type.includes("passport") &&
    !type.includes("driver") &&
    !type.includes("utility")
  );
}

/**
 * Each BVN and NIN may only be linked to one ORYNO account.
 * Rejected submissions are ignored so a user can correct and resubmit.
 */
export async function assertUniqueIdentity(
  userId: string,
  idType: string,
  idNumber: string,
) {
  const digits = digitsOnly(idNumber);
  if (!/^\d{11}$/.test(digits)) return;

  const kind = isBvnIdType(idType) ? "bvn" : isNinIdType(idType) ? "nin" : null;
  if (!kind) return;

  const rows = await db.query.kycSubmissions.findMany({
    where: and(
      ne(kycSubmissions.userId, userId),
      not(eq(kycSubmissions.status, "rejected")),
    ),
    columns: { idType: true, idNumber: true },
  });

  for (const row of rows) {
    if (digitsOnly(row.idNumber) !== digits) continue;
    if (!rowMatchesIdentityKind(row.idType || "", kind)) continue;

    throw new IdentityConflictError(
      kind === "bvn"
        ? "This BVN is already linked to another ORYNO account. Each person may only use one account."
        : "This NIN is already linked to another ORYNO account. Each person may only use one account.",
    );
  }
}
