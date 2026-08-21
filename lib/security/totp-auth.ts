import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { userSecurity } from "@/lib/db/schema";
import { decryptPin, encryptPin } from "@/lib/security/pin-crypto";
import {
  generateTotpSecret,
  totpOtpauthUri,
  verifyTotpCode,
} from "@/lib/security/totp";
import {
  issueTwoFactorToken,
  isTwoFactorTokenValid,
  readTwoFactorToken,
} from "@/lib/security/totp-session";

const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;

export class TotpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "TotpError";
  }
}

export async function getOrCreateSecurity(userId: string) {
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

function assertNotLocked(row: typeof userSecurity.$inferSelect) {
  if (row.totpLockedUntil && row.totpLockedUntil.getTime() > Date.now()) {
    throw new TotpError(
      "Too many incorrect codes. Try again in a few minutes.",
      429,
      "totp_locked",
    );
  }
}

async function recordFailure(userId: string, currentFails: number) {
  const next = currentFails + 1;
  const locked = next >= MAX_FAILS;
  await db
    .update(userSecurity)
    .set({
      failedTotpAttempts: next,
      totpLockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, userId));
  if (locked) {
    throw new TotpError(
      "Too many incorrect codes. Try again in a few minutes.",
      429,
      "totp_locked",
    );
  }
}

async function clearFailures(userId: string) {
  await db
    .update(userSecurity)
    .set({
      failedTotpAttempts: 0,
      totpLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, userId));
}

async function clerkSessionId() {
  try {
    const { sessionId } = await auth();
    return sessionId || null;
  } catch {
    return null;
  }
}

export async function twoFactorStatus(input: {
  userId: string;
  request?: Request;
}) {
  const security = await getOrCreateSecurity(input.userId);
  const required = Boolean(security.twoFactorEnabled && security.totpSecretEncrypted);
  if (!required) {
    return { required: false, verified: true };
  }
  const token = await readTwoFactorToken(input.request);
  const verified = isTwoFactorTokenValid({
    token,
    userId: input.userId,
    sessionId: await clerkSessionId(),
  });
  return { required: true, verified };
}

export async function startTotpSetup(input: {
  userId: string;
  accountLabel: string;
}) {
  const security = await getOrCreateSecurity(input.userId);
  if (security.twoFactorEnabled && security.totpSecretEncrypted) {
    throw new TotpError(
      "Authenticator is already enabled. Turn it off before setting up a new one.",
      400,
      "already_enabled",
    );
  }

  const secret = generateTotpSecret();
  await db
    .update(userSecurity)
    .set({
      totpPendingSecretEncrypted: encryptPin(secret),
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, input.userId));

  return {
    secret,
    uri: totpOtpauthUri(secret, input.accountLabel),
  };
}

export async function enableTotp(input: { userId: string; code: string }) {
  const security = await getOrCreateSecurity(input.userId);
  assertNotLocked(security);

  const pending = decryptPin(security.totpPendingSecretEncrypted);
  if (!pending) {
    throw new TotpError(
      "Start authenticator setup again, then enter a fresh code.",
      400,
      "setup_required",
    );
  }

  if (!verifyTotpCode(pending, input.code)) {
    await recordFailure(input.userId, security.failedTotpAttempts);
    throw new TotpError("Invalid authenticator code. Try again.", 400, "invalid_code");
  }

  await db
    .update(userSecurity)
    .set({
      twoFactorEnabled: true,
      totpSecretEncrypted: encryptPin(pending),
      totpPendingSecretEncrypted: null,
      failedTotpAttempts: 0,
      totpLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, input.userId));

  return issueTwoFactorToken(input.userId, await clerkSessionId());
}

export async function disableTotp(input: { userId: string; code: string }) {
  const security = await getOrCreateSecurity(input.userId);
  assertNotLocked(security);

  const secret = decryptPin(security.totpSecretEncrypted);
  if (!security.twoFactorEnabled || !secret) {
    await db
      .update(userSecurity)
      .set({
        twoFactorEnabled: false,
        totpSecretEncrypted: null,
        totpPendingSecretEncrypted: null,
        failedTotpAttempts: 0,
        totpLockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(userSecurity.userId, input.userId));
    return;
  }

  if (!verifyTotpCode(secret, input.code)) {
    await recordFailure(input.userId, security.failedTotpAttempts);
    throw new TotpError("Invalid authenticator code. Try again.", 400, "invalid_code");
  }

  await db
    .update(userSecurity)
    .set({
      twoFactorEnabled: false,
      totpSecretEncrypted: null,
      totpPendingSecretEncrypted: null,
      failedTotpAttempts: 0,
      totpLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userSecurity.userId, input.userId));
}

export async function verifyLoginTotp(input: {
  userId: string;
  code: string;
}) {
  const security = await getOrCreateSecurity(input.userId);
  assertNotLocked(security);

  const secret = decryptPin(security.totpSecretEncrypted);
  if (!security.twoFactorEnabled || !secret) {
    throw new TotpError("Authenticator is not enabled on this account.", 400, "not_enabled");
  }

  if (!verifyTotpCode(secret, input.code)) {
    await recordFailure(input.userId, security.failedTotpAttempts);
    throw new TotpError("Invalid authenticator code. Try again.", 400, "invalid_code");
  }

  await clearFailures(input.userId);
  return issueTwoFactorToken(input.userId, await clerkSessionId());
}

export function jsonTotpError(error: unknown) {
  if (error instanceof TotpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  console.error("[totp]", error);
  return { status: 500, body: { error: "Authenticator request failed" } };
}
