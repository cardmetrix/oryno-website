import { db } from "@/lib/db";
import { beneficiaries } from "@/lib/db/schema";

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
  const [row] = await db
    .insert(beneficiaries)
    .values({
      userId: input.userId,
      phone,
      networkId: input.networkId || null,
      label: input.label?.trim() || null,
      lastUsedAt: now,
    })
    .onConflictDoUpdate({
      target: [beneficiaries.userId, beneficiaries.phone],
      set: {
        ...(input.networkId ? { networkId: input.networkId } : {}),
        ...(input.label?.trim() ? { label: input.label.trim() } : {}),
        lastUsedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return row ?? null;
}

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
