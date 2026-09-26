"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WALLET_QUERY_KEY } from "@/lib/query-keys";

type SettleResult = {
  ok?: boolean;
  queued?: boolean;
  scanned?: number;
  completed?: number;
  reversed?: number;
  failed?: number;
};

const POLL_MS = 5 * 60_000;
const INITIAL_DELAY_MS = 4_000;

/**
 * Queues server-side pending-tx / boost sync (non-blocking).
 * Wallet and history refresh via useProcessingTransactionRefresh when txs are open.
 */
export function useSettlePendingTransactions(enabled = true) {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const settle = useCallback(async () => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/transactions/settle", {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as SettleResult;
      if (json.queued) {
        window.setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
        }, 12_000);
        return json;
      }
      if (
        (json.completed ?? 0) + (json.reversed ?? 0) + (json.failed ?? 0) >
        0
      ) {
        void queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
      }
      return json;
    } catch (error) {
      console.error("[settle-pending-hook]", error);
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) return;
    const startId = window.setTimeout(() => {
      void settle();
    }, INITIAL_DELAY_MS);
    const id = window.setInterval(() => {
      void settle();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void settle();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(startId);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, settle]);

  return { settle };
}
