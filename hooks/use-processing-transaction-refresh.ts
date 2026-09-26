"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WALLET_QUERY_KEY } from "@/lib/query-keys";
import { useWallet } from "@/hooks/use-wallet";

const OPEN = new Set(["pending", "processing"]);
const REFRESH_MS = 30_000;

/** Refetch wallet while any recent tx is still pending/processing (e.g. boosts). */
export function useProcessingTransactionRefresh(enabled = true) {
  const queryClient = useQueryClient();
  const { data } = useWallet({ enabled });

  const hasOpen =
    enabled &&
    (data?.recent?.some((tx) => OPEN.has(String(tx.status).toLowerCase())) ??
      false);

  useEffect(() => {
    if (!hasOpen) return;
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [hasOpen, queryClient]);
}
