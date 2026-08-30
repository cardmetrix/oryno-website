import { and, eq, gte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

const LOCK_CLASS = 87421;
const IN_FLIGHT_MS = 90_000;

export class ActionInProgressError extends Error {
  status = 409;
  code = "action_in_progress" as const;
  constructor(message = "Another payment is already in progress. Wait for it to finish, then try again.") {
    super(message);
    this.name = "ActionInProgressError";
  }
}

export function isActionLockError(error: unknown): error is ActionInProgressError {
  return (
    error instanceof ActionInProgressError ||
    (error as { code?: string } | null)?.code === "action_in_progress"
  );
}

export function actionLockHttpStatus(error: unknown) {
  return isActionLockError(error) ? 409 : null;
}

function advisoryKey(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) | 0;
  }
  return hash === 0 ? 1 : hash;
}

async function tryLock(key: number) {
  const result = (await db.execute(
    sql`select pg_try_advisory_lock(${LOCK_CLASS}, ${key}) as locked`,
  )) as unknown;
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] })?.rows ?? []);
  const row = rows[0] as { locked?: boolean | string } | undefined;
  return row?.locked === true || row?.locked === "t" || row?.locked === "true";
}

async function unlock(key: number) {
  try {
    await db.execute(sql`select pg_advisory_unlock(${LOCK_CLASS}, ${key})`);
  } catch (error) {
    console.error("[action-lock-unlock]", error);
  }
}

async function assertNoRecentInFlight(userId: string) {
  const since = new Date(Date.now() - IN_FLIGHT_MS);
  const inflight = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.userId, userId),
      inArray(transactions.status, ["pending", "processing"]),
      inArray(transactions.type, ["debit"]),
      gte(transactions.updatedAt, since),
    ),
  });
  if (inflight) {
    throw new ActionInProgressError();
  }
}

/** One wallet debit/payout at a time per user. Second request gets 409. */
export async function withUserActionLock<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = advisoryKey(userId);
  const locked = await tryLock(key);
  if (!locked) {
    throw new ActionInProgressError();
  }
  try {
    await assertNoRecentInFlight(userId);
    return await fn();
  } finally {
    await unlock(key);
  }
}
