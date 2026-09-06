"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WALLET_QUERY_KEY } from "@/lib/query-keys";

type SettleResult = {
  ok?: boolean;
  scanned?: number;
  completed?: number;
  reversed?: number;
  failed?: number;
};

const POLL_MS = 60_000;

/**
 * Checks pending/processing transactions older than 5 minutes from createdAt,
 * then completes, fails, or reverses them based on the provider state.
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
      });
      if (!res.ok) return null;
      const json = (await res.json()) as SettleResult;
      if ((json.completed ?? 0) + (json.reversed ?? 0) + (json.failed ?? 0) > 0) {
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
    void settle();
    const id = window.setInterval(() => {
      void settle();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void settle();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, settle]);

  return { settle };
}
