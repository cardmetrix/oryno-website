"use client";

import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { WALLET_QUERY_KEY } from "@/lib/query-keys";
import type { WalletPayload } from "@/lib/wallet-types";

export { WALLET_QUERY_KEY };

export async function fetchWallet(): Promise<WalletPayload> {
  const res = await fetch("/api/wallet", {
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error("Failed to load wallet");
  return (await res.json()) as WalletPayload;
}

type WalletQueryOptions = Omit<
  UseQueryOptions<WalletPayload, Error, WalletPayload, typeof WALLET_QUERY_KEY>,
  "queryKey" | "queryFn"
>;

export function useWallet(options?: WalletQueryOptions) {
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: fetchWallet,
    staleTime: 20_000,
    ...options,
  });
}

export function useInvalidateWallet() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
}
