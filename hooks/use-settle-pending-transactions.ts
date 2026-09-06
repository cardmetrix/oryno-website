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

/**
 * On History (and similar pages), settle any pending transaction older than
 * 5 minutes: complete it if the provider succeeded, otherwise fail/reverse
 * it back to the user's ORYNO wallet.
 */
export function useSettlePendingTransactions(enabled = true) {
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  const settle = useCallback(async () => {
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
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    ranRef.current = true;
    void settle();
  }, [enabled, settle]);

  return { settle };
}
