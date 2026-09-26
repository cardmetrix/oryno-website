import { after } from "next/server";

export type BackgroundSettleMode = "quick" | "full";

async function runUserBackgroundSettle(
  userId: string,
  mode: BackgroundSettleMode,
) {
  const m = await import("@/lib/wallet/settle-user-pending");
  await m.settleUserPendingTransactions({
    userId,
    limit: mode === "full" ? 15 : 10,
    pollSocialBoosts: false,
  });
  await m.syncPendingSocialBoosts({
    userId,
    limit: mode === "full" ? 6 : 3,
  });
}

/** Run pending-tx / boost status work after the HTTP response (no user-facing latency). */
export function scheduleUserBackgroundSettle(
  userId: string,
  mode: BackgroundSettleMode = "quick",
) {
  const task = () => {
    void runUserBackgroundSettle(userId, mode).catch((error) => {
      console.error("[background-settle]", userId, error);
    });
  };

  try {
    after(task);
  } catch {
    task();
  }
}
