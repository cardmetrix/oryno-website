import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSecurity } from "@/lib/db/schema";
import { decryptPin, encryptPin } from "@/lib/security/pin-crypto";

export const PIN_PATTERN = /^\d{4,6}$/;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

export class TransactionPinError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "pin_error") {
    super(message);
    this.name = "TransactionPinError";
    this.status = status;
    this.code = code;
  }
}

export function isValidPinFormat(pin: string) {
  return PIN_PATTERN.test(pin.trim());
}

async function getOrCreateSecurity(userId: string) {
  const existing = await db.query.userSecurity.findFirst({
    where: eq(userSecurity.userId, userId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(userSecurity)
    .values({ userId })
    .returning();
  return created;
}

export async function getTransactionPinStatus(userId: string) {
  const security = await getOrCreateSecurity(userId);
  const locked =
    security.lockedUntil != null && security.lockedUntil.getTime() > Date.now();
  return {
    hasPin: Boolean(security.pinHash),
    failedPinAttempts: security.failedPinAttempts,
    lockedUntil: security.lockedUntil,
    isLocked: locked,
  };
}

export async function setTransactionPin(input: {
  userId: string;
  pin: string;
  currentPin?: string;
}): Promise<{ created: boolean }> {
  const pin = input.pin.trim();
  if (!isValidPinFormat(pin)) {
    throw new TransactionPinError("PIN must be 4–6 digits.");
  }

  const security = await getOrCreateSecurity(input.userId);
  const hadPin = Boolean(security.pinHash);

  if (hadPin) {
    if (!input.currentPin) {
      throw new TransactionPinError("Current PIN is required to change it.");
    }
    await verifyTransactionPin(input.userId, input.currentPin);
  }

  await db
    .update(userSecurity)
    .set({
      pinHash: await bcrypt.hash(pin, 10),
      pinEncrypted: encryptPin(pin),
      failedPinAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, input.userId));

  return { created: !hadPin };
}

/** Admin / support: set or replace PIN without knowing the current one. */
export async function adminSetTransactionPin(userId: string, pin: string) {
  const next = pin.trim();
  if (!isValidPinFormat(next)) {
    throw new TransactionPinError("PIN must be 4–6 digits.");
  }
  await getOrCreateSecurity(userId);
  await db
    .update(userSecurity)
    .set({
      pinHash: await bcrypt.hash(next, 10),
      pinEncrypted: encryptPin(next),
      failedPinAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, userId));
}

export async function adminClearTransactionPin(userId: string) {
  await getOrCreateSecurity(userId);
  await db
    .update(userSecurity)
    .set({
      pinHash: null,
      pinEncrypted: null,
      failedPinAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, userId));
}

export async function adminUnlockTransactionPin(userId: string) {
  await getOrCreateSecurity(userId);
  await db
    .update(userSecurity)
    .set({
      failedPinAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, userId));
}

export async function getDecryptedTransactionPin(userId: string) {
  const security = await getOrCreateSecurity(userId);
  return decryptPin(security.pinEncrypted);
}

export async function verifyTransactionPin(
  userId: string,
  pin: string,
  options?: { consumeAttempt?: boolean; requireSet?: boolean },
) {
  const requireSet = options?.requireSet !== false;
  const consumeAttempt = options?.consumeAttempt !== false;
  const security = await getOrCreateSecurity(userId);

  if (!security.pinHash) {
    if (requireSet) {
      throw new TransactionPinError(
        "Set a transaction PIN in Security settings before continuing.",
        400,
        "pin_required",
      );
    }
    return true;
  }

  if (security.lockedUntil && security.lockedUntil.getTime() > Date.now()) {
    const mins = Math.max(
      1,
      Math.ceil((security.lockedUntil.getTime() - Date.now()) / 60_000),
    );
    throw new TransactionPinError(
      `Transaction PIN locked. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
      423,
      "pin_locked",
    );
  }

  const candidate = pin?.trim() ?? "";
  if (!isValidPinFormat(candidate)) {
    throw new TransactionPinError("Enter your 4–6 digit transaction PIN.");
  }

  const ok = await bcrypt.compare(candidate, security.pinHash);
  if (ok) {
    if (security.failedPinAttempts > 0 || security.lockedUntil) {
      await db
        .update(userSecurity)
        .set({
          failedPinAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(userSecurity.userId, userId));
    }
    return true;
  }

  if (consumeAttempt) {
    const attempts = security.failedPinAttempts + 1;
    const lockedUntil =
      attempts >= MAX_PIN_ATTEMPTS
        ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000)
        : null;
    await db
      .update(userSecurity)
      .set({
        failedPinAttempts: attempts,
        lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(userSecurity.userId, userId));

    if (lockedUntil) {
      throw new TransactionPinError(
        `Too many incorrect attempts. PIN locked for ${PIN_LOCK_MINUTES} minutes.`,
        423,
        "pin_locked",
      );
    }

    throw new TransactionPinError(
      `Incorrect transaction PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt${MAX_PIN_ATTEMPTS - attempts === 1 ? "" : "s"} left.`,
      400,
      "pin_invalid",
    );
  }

  throw new TransactionPinError("Incorrect transaction PIN.", 400, "pin_invalid");
}

export async function requireTransactionPin(userId: string, pin: string | undefined) {
  if (!pin) {
    throw new TransactionPinError(
      "Transaction PIN is required to continue.",
      400,
      "pin_required",
    );
  }
  await verifyTransactionPin(userId, pin);
}
