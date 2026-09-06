"use client";

import { useCallback } from "react";
import { useWallet, useInvalidateWallet } from "@/hooks/use-wallet";

export function useWalletBalance() {
  const { data, isLoading } = useWallet();
  const invalidate = useInvalidateWallet();

  const balance = data ? Number(data.primary?.balance ?? 0) : null;
  const ngnBalance = data
    ? data.ledgerNgn != null
      ? Number(data.ledgerNgn)
      : Number(data.primary?.balance ?? 0)
    : null;
  const usdBalance = data
    ? Number(data.usd?.balance ?? data.totals?.usdBalance ?? 0)
    : null;
  const currency = data?.primary?.currency ?? "NGN";
  const nextStatus = data?.primary?.status;
  const status =
    nextStatus === "frozen" || nextStatus === "closed" || nextStatus === "healthy"
      ? nextStatus
      : data
        ? "healthy"
        : null;

  const loading = isLoading && !data;
  const walletReady = !loading && status !== "frozen" && status !== "closed";

  const canAfford = useCallback(
    (amount: number) => {
      if (loading || balance == null || !walletReady) return false;
      if (!Number.isFinite(amount) || amount <= 0) return true;
      return amount <= balance + 0.0001;
    },
    [loading, walletReady, balance],
  );

  const canAffordUsd = useCallback(
    (amount: number) => {
      if (loading || usdBalance == null || !walletReady) return false;
      if (!Number.isFinite(amount) || amount <= 0) return true;
      return amount <= usdBalance + 0.0001;
    },
    [loading, walletReady, usdBalance],
  );

  const canAffordNgn = useCallback(
    (amount: number) => {
      if (loading || ngnBalance == null || !walletReady) return false;
      if (!Number.isFinite(amount) || amount <= 0) return true;
      return amount <= ngnBalance + 0.0001;
    },
    [loading, walletReady, ngnBalance],
  );

  return {
    balance,
    ngnBalance,
    usdBalance,
    currency,
    status,
    loading,
    frozen: status === "frozen" || status === "closed",
    refresh: invalidate,
    canAfford,
    canAffordUsd,
    canAffordNgn,
  };
}
