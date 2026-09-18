import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { beneficiaries } from "@/lib/db/schema";

export type BeneficiaryDto = {
  id: string;
  phone: string;
  label: string | null;
  networkId: string | null;
  lastUsedAt: string | null;
};

export async function listBeneficiaries(
  userId: string,
  limit = 30,
): Promise<BeneficiaryDto[]> {
  const rows = await db
    .select({
      id: beneficiaries.id,
      phone: beneficiaries.phone,
      label: beneficiaries.label,
      networkId: beneficiaries.networkId,
      lastUsedAt: beneficiaries.lastUsedAt,
    })
    .from(beneficiaries)
    .where(eq(beneficiaries.userId, userId))
    .orderBy(desc(beneficiaries.lastUsedAt), desc(beneficiaries.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 50));

  return rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    label: row.label,
    networkId: row.networkId,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  }));
}

/** Persist or refresh a phone beneficiary after a successful telecom purchase. */
export async function upsertBeneficiary(input: {
  userId: string;
  phone: string;
  networkId?: string | null;
  label?: string | null;
}) {
  const phone = input.phone.trim();
  if (!phone || phone.length < 8) return null;

  const now = new Date();
  const existing = await db
    .select()
    .from(beneficiaries)
    .where(
      and(
        eq(beneficiaries.userId, input.userId),
        eq(beneficiaries.phone, phone),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    const [row] = await db
      .update(beneficiaries)
      .set({
        ...(input.networkId ? { networkId: input.networkId } : {}),
        ...(input.label?.trim() ? { label: input.label.trim() } : {}),
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(beneficiaries.id, existing.id))
      .returning();
    return row ?? existing;
  }

  const [row] = await db
    .insert(beneficiaries)
    .values({
      userId: input.userId,
      phone,
      networkId: input.networkId || null,
      label: input.label?.trim() || null,
      lastUsedAt: now,
    })
    .returning();

  return row ?? null;
}

/** Never throws — purchase success must not depend on beneficiary persistence. */
export async function maybeSaveBeneficiary(input: {
  save?: boolean;
  userId: string;
  phone: string;
  networkId?: string | null;
  label?: string | null;
}) {
  if (!input.save) return null;
  try {
    return await upsertBeneficiary(input);
  } catch (error) {
    console.error("[beneficiary-save]", error);
    return null;
  }
}
