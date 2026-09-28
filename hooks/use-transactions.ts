"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { TRANSACTIONS_QUERY_KEY } from "@/lib/query-keys";
import type { AppTransaction } from "@/lib/transactions";

export { TRANSACTIONS_QUERY_KEY };

export async function fetchTransactions(): Promise<AppTransaction[]> {
  const res = await fetch("/api/transactions", {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error("Failed to load transactions");
  const json = (await res.json()) as { items?: AppTransaction[] };
  return json.items ?? [];
}

export function useTransactions() {
  return useQuery({
    queryKey: TRANSACTIONS_QUERY_KEY,
    queryFn: fetchTransactions,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateTransactions() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
}
